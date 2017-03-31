/**
 lib/cache.ts

 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.

 Cache is a projection of the persistent storage.
 The API is only working with cache, which takes care
 of reflecting on the DB.

 Everything is identified with an UUID.

*/

import * as debug from 'debug';
import * as Promise from 'bluebird';
import { client as persistentClient } from './db';
import { client as kvClient } from './store';
import { client as indexerClient } from './indexer';
import { Record, RecordType, record, ModelData, BaseModelData } from './models';
import { QueryResult } from "pg";

const logger = debug('waend:cache');

const logError =
    (name: string) => (err: Error) => {
        logger(`:error [${name}]: ${err}`);
    };

type ModelDataResolveFn = (a: ModelData) => void;
type ModelDataListResolveFn = (a: ModelData[]) => void;
type RejectFn = (a: Error) => void;

const getFromPersistent: (a: RecordType, b: string) => Promise<ModelData> =
    (objType, id) => {
        const queryName = objType + 'Get',
            typeHandler = record(objType),
            params = [id];

        const resolver: (a: ModelDataResolveFn, b: RejectFn) => void =
            (resolve, reject) => {
                persistentClient()
                    .query(queryName, params)
                    .then((result) => {
                        if (result.rowCount > 0) {
                            const obj = typeHandler.buildFromPersistent(result.rows[0]);
                            resolve(obj);
                        }
                        else {
                            reject(new Error('NotFound'));
                        }
                    })
                    .catch(reject);
            };

        return (new Promise(resolver));
    }

const queryPersistent: (a: string, b: RecordType, c: any[]) => Promise<ModelData[]> =
    (queryName, objType, params = []) => {
        const typeHandler = record(objType);

        const resolver: (a: ModelDataListResolveFn, b: RejectFn) => void =
            (resolve, reject) => {
                persistentClient()
                    .query(queryName, params)
                    .then((result) => {
                        if (result.rowCount > 0) {
                            resolve(
                                result.rows.map((row) => typeHandler.buildFromPersistent(row)));
                        }
                        else {
                            reject(new Error('EmptyResultSet'));
                        }
                    })
                    .catch(reject);
            };

        return (new Promise(resolver));
    }



const saveToPersistent: (a: RecordType, b: (ModelData | BaseModelData)) => Promise<QueryResult> =
    (objType, obj) => {
        const op = ('id' in obj) ? 'Update' : 'Create';
        const recName = RecordType[objType];
        const queryName = recName + op;
        const rec = record(objType);
        const prepObj = rec.prepare(obj);
        const params = rec.getParameters(prepObj);

        return persistentClient().query(queryName, params);
    }





/**
 * A CacheItem is responsible for maintaining a connection between
 * a map data and a JSON string representing this data ready to be served.
 * @method CacheItem
 * @param  {string}  mapId A map uuid
 */

interface CacheItem {
    id: string;
    created: number;
    reloadTimeoutID: null | number;
    isActive: boolean;
    data: any;
    deps: string[];
    dirty: boolean;
}

const cacheItem: (a: string) => CacheItem =
    (mapId) => {
        return {
            id: mapId,
            created: Date.now(),
            reloadTimeoutID: null,
            isActive: false,
            data: null,
            deps: [],
            dirty: true,
        }
    }


/**
 * updates a record on the KV store
 */
const updateRecord: (a: CacheItem) => Promise<void> =
    (item) => {
        const objString = JSON.stringify(item.data);
        item.deps = item.data.group.layers.map((layer) => layer.id);

        return kvClient().put(item.id, objString)
            .then(() => {
                markClean(item);
            })
            .catch(logError('CacheItem.updateRecord'));
    };


const getFeatures = (groupData: ModelData) => (lyr: ModelData) => {
    const layerId: string = lyr.id;
    const queries: Promise<QueryResult>[] = [];
    const records: Record[] = [];
    const features: ModelData[] = [];
    const types = [RecordType.Entity, RecordType.Path, RecordType.Spread];

    types.forEach((t) => {
        const tName = RecordType[t];
        queries.push(
            persistentClient().query(`${tName}GetLayer`, [layerId]));
        records.push(record(t));
    });

    const mapper = (result: QueryResult, index: number) => {
        const rec = records[index];
        result.rows.forEach((row) => {
            features.push(rec.buildFromPersistent(row));
        });
    };

    return Promise.map(queries, mapper)
        .then(() => {
            lyr.features = features;
            groupData.group.layers.push(lyr);
        });

};



const getCompositions = (item: CacheItem, groupData: ModelData) => (result: QueryResult) => {
    if (result.rowCount > 0) {
        return (
            Promise
                .map(result.rows, (composition) =>
                    getFromPersistent(RecordType.Layer, composition.layer_id))
                .map(getFeatures(groupData))
                .then(() => { updateRecord(item); }));
    }
    return updateRecord(item);
}

/**
 * load data from persistent storage and insert it in a kv store
 * @method load
 * @return {CacheItem} itself
 */
const loadItem: (a: CacheItem) => Promise<void> =
    (item) => {
        item.data = {};
        item.dirty = true;

        const getGroup = (group: ModelData) => {
            item.data.group = group;
            item.data.group.layers = [];
            return (
                persistentClient()
                    .query('compositionGetForGroup', [item.id])
                    .catch(logError('CacheItem.load.getGroup')));
        }

        return (
            getFromPersistent(RecordType.Group, item.id)
                .then(getGroup)
                .then(getCompositions(item, item.data))
                .catch(logError('CacheItem.load')));
    };

/**
 * get the data out of the KV store
 */
const getJSON: (a: CacheItem) => Promise<string> =
    (item) => {
        return kvClient().get(item.id);
    };


const markDirty: (a: CacheItem) => void =
    (item) => {
        item.dirty = true;
        if (item.reloadTimeoutID !== null) {
            clearTimeout(item.reloadTimeoutID);
        }
        this.reloadTimeoutID = setTimeout(() => { loadItem(item); }, 1000 * 60);
    };

const markClean: (a: CacheItem) => void =
    (item) => {
        item.dirty = false;
        item.data = null;
        if (item.reloadTimeoutID !== null) {
            clearTimeout(item.reloadTimeoutID);
        }
        item.reloadTimeoutID = null;
    };



const itemLoader = (item: CacheItem) => {
    return (new Promise((resolve, reject) => {
        loadItem(item)
            .then(() => { resolve(item); })
            .catch(reject);
    }));
};

const CacheStore = () => {
    const storedGroups = new Map<string, CacheItem>();


    const get = (gid: string) => {
        logger(`CacheStore.get ${gid}`);
        let item;
        if (storedGroups.has(gid)) {
            logger('Is In Store');
            item = storedGroups.get(gid);
            if (!item.dirty) {
                logger('Is Clean');
                return Promise.resolve(item);
            }
            else {
                logger('Is Dirty');
                itemLoader(item);
            }
        }
        else {
            item = cacheItem(gid);
            storedGroups.set(gid, item);
            logger('Is Not In Store, insert', gid);
            return itemLoader(item);
        }
    };


    const actionCreate = (objType: RecordType, data: ModelData, groups: any[]) => {
        if (RecordType.Composition === objType) {
            if (storedGroups.has(data.group_id)) {
                const lid = data.layer_id;
                const citem = storedGroups.get(data.group_id);
                citem.deps.push(lid);
                markDirty(citem);
                logger('Mark Dirty', data.group_id);
            }
        }
        else if (RecordType.Entity === objType
            || RecordType.Path === objType
            || RecordType.Spread === objType) {

            const layerId = data.layer_id;
            storedGroups.forEach((item, gid) => {
                if (item.deps.find((lid) => lid === data.layer_id)) {
                    markDirty(item);
                    groups.push(gid);
                    logger('Mark Dirty', gid);
                }
            });
        }
    };

    const actionUpdate = (objType: RecordType, data: ModelData, groups: any[]) => {
        if (RecordType.Group === objType) {
            if (storedGroups.has(data.id)) {
                markDirty(storedGroups.get(data.id));
            }
            groups.push(data.id);
        }
        else {
            let layerId;
            if (RecordType.Layer === objType) {
                layerId = data.id;
            }
            else if (RecordType.Entity === objType
                || RecordType.Path === objType
                || RecordType.Spread === objType) {
                layerId = data.layer_id;
            }

            storedGroups.forEach((item, gid) => {
                if (item.deps.find((lid) => lid === layerId)) {
                    markDirty(item);
                    groups.push(gid);
                    logger('Mark Dirty', gid);
                }
            });
        }
    };


    const actionDelete = (objType: RecordType, data: ModelData, groups: any[]) => {
        if (RecordType.Composition === objType) {
            if (storedGroups.has(data.group_id)) {
                const lid = data.layer_id;
                const citem = storedGroups.get(data.group_id);
                citem.deps = citem.deps.filter((id) => id !== lid);
                markDirty(citem);
                logger('Mark Dirty', data.group_id);
            }
        }
        else if ('entity' === objType
            || 'path' === objType
            || 'spread' === objType) {

            const layerId = data.layer_id;

            _.each(this.groups, function (item, gid) {
                if (_.indexOf(item.deps, layerId) >= 0) {
                    item.markDirty();
                    groups.push(gid);
                    logger('Mark Dirty', gid);
                }
            }, this);
        }
    };



}










CacheStore.prototype.updateGroups = function (objType, action, data) {
    logger('CacheStore.updateGroups', objType);
    const groups = [];
    switch (action) {
        case 'create':
            this.actionCreate(objType, data, groups);
            break;
        case 'update':
            this.actionUpdate(objType, data, groups);
            break;
        case 'delete':
            this.actionDelete(objType, data, groups);
            break;
    }
    if (groups.length > 0) {
        indexerClient.update(objType, groups, data);
    }
};



function Cache() {
    this.cs = new CacheStore();
}


_.extend(Cache.prototype, {

    get: function (type, id) {
        return getFromPersistent(type, id);
    },

    set: function (objType, obj) {
        const self = this,
            action = ('id' in obj) ? 'update' : 'create';

        const resolver = function (resolve, reject) {
            saveToPersistent(objType, obj)
                .then(function (res) {
                    if (res.length > 0) {
                        const newObj = Types[objType].buildFromPersistent(res[0]);
                        resolve(newObj);
                        self.cs.updateGroups(objType, action, newObj);
                    }
                })
                .catch(reject);
        };

        return new Promise(resolver);
    },

    setFeature: function (obj) {
        const geomType = (obj.geom) ? obj.geom.type : 'x';

        if ('Point' === geomType) {
            return this.set('entity', obj);
        }
        else if ('LineString' === geomType) {
            return this.set('path', obj);
        }
        else if ('Polygon' === geomType) {
            return this.set('spread', obj);
        }

        return Promise.reject('unsupported geometry type');
    },

    delFeature: function (lid, fid, geomType) {
        const self = this;

        const resolver = function (resolve, reject) {
            const featureType,
                queryName;

            if ('point' === geomType) {
                featureType = 'entity';
            }
            else if ('linestring' === geomType) {
                featureType = 'path';
            }
            else if ('polygon' === geomType) {
                featureType = 'spread';
            }
            queryName = featureType + 'Delete';

            persistentClient.query(queryName, [fid])
                .then(function () {
                    resolve();
                    self.cs.updateGroups(featureType, 'delete', {
                        'id': fid,
                        'layer_id': lid
                    });
                })
                .catch(reject);
        };

        return new Promise(resolver);
    },

    delComposition: function (groupId, layerId) {
        const self = this;

        const resolver = function (resolve, reject) {
            persistentClient.query('compositionDelete', [groupId, layerId])
                .then(function () {
                    self.cs.updateGroups('composition', 'delete', {
                        'group_id': groupId
                    });
                    resolve();
                })
                .catch(reject);
        };

        return new Promise(resolver);
    },



    getGroup: function (gid) {
        const ccst = this.cs;
        const resolver = function (resolve, reject) {
            ccst.get(gid)
                .then(function (item) {
                    resolve(item.toJSON());
                })
                .catch(reject);
        };
        return (new Promise(resolver));
    },

    lookupGroups: function (term) {
        const self = this;
        const transform = function (result) {
            // logger(result);
            const response = result.response,
                docs = response.docs,
                objs = [];
            for (const i = 0; i < docs.length; i++) {
                const doc = docs[i],
                    groups = doc.groups || [];
                // logger('::', doc);
                for (const j = 0; j < groups.length; j++) {
                    objs.push(self.get('group', groups[j]));
                }
            }

            return Promise.all(objs);
        };
        return indexerClient.search('*' + term + '*').then(transform);
    },

    query: function (qname, type, args) {
        return queryPersistent(qname, type, args);
    }


});


module.exports.configure = function () {
    if (cacheInstance) {
        return;
    }
    kvClient = Store.client();
    persistentClient = Database.client();
    indexerClient = Indexer.client();
    cacheInstance = new Cache();
};


module.exports.client = function () {
    if (!cacheInstance) {
        throw (new Error('Cache not configured'));
    }
    return cacheInstance;
};

logger('module loaded');
