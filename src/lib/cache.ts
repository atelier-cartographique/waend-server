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

enum CacheStoreAction {
    Create,
    Update,
    Delete
}

interface ICacheStore {
    get(a: string): Promise<any>;
    update(a: RecordType, b: CacheStoreAction, c: ModelData): void;
}

const CacheStore: () => ICacheStore =
    () => {
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


        const dirtyDeps = (objType: RecordType, data: ModelData, groups: any[]) => {
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
            else {
                dirtyDeps(objType, data, groups);
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
                dirtyDeps(objType, data, groups);
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
            else {
                dirtyDeps(objType, data, groups);
            }
        };

        const updateGroups = (objType: RecordType, action: CacheStoreAction, data: ModelData) => {
            logger('CacheStore.updateGroups', objType);
            const groups = [];
            switch (action) {
                case CacheStoreAction.Create:
                    actionCreate(objType, data, groups);
                    break;
                case CacheStoreAction.Update:
                    actionUpdate(objType, data, groups);
                    break;
                case CacheStoreAction.Delete:
                    actionDelete(objType, data, groups);
                    break;
            }
            if (groups.length > 0) {
                indexerClient().update(objType, groups, data);
            }
        };

        return { get, update: updateGroups };
    }



export interface ICache {
    get(a: RecordType, b: string): Promise<ModelData>;
    set(a: RecordType, b: BaseModelData | ModelData): Promise<ModelData>;
    setFeature(b: BaseModelData | ModelData): Promise<ModelData>;
    delFeature(a: string, b: string, c: string): Promise<void>;
    delComposition(a: string): Promise<void>;
    getGroup(a: string): Promise<string>;
    lookupGroups(a: string): Promise<ModelData[]>;
    query(a: string, b: RecordType, c: any[]): Promise<ModelData[]>;
}

const cacheStore = CacheStore();

const Cache: () => ICache =
    () => {


        const get = (type: RecordType, id: string) => {
            return getFromPersistent(type, id);
        };


        const set = (objType: RecordType, obj: BaseModelData | ModelData) => {
            const action = ('id' in obj) ? CacheStoreAction.Update : CacheStoreAction.Create;

            const resolver = (resolve: (a: ModelData) => void) => {
                saveToPersistent(objType, obj)
                    .then(function (res) {
                        if (res.rowCount > 0) {
                            const newObj = record(objType)
                                .buildFromPersistent(res.rows[0]);
                            resolve(newObj);
                            cacheStore.update(objType, action, newObj);
                        }
                    });
            };

            return new Promise(resolver);
        };


        const setFeature = (obj: ModelData) => {
            const geomType = (obj.geom) ? obj.geom.type : 'GeometryNone';

            if ('Point' === geomType) {
                return set(RecordType.Entity, obj);
            }
            else if ('LineString' === geomType) {
                return set(RecordType.Path, obj);
            }
            else if ('Polygon' === geomType) {
                return set(RecordType.Spread, obj);
            }

            return Promise.reject(`unsupported geometry type ${geomType}`);
        };


        const delFeature = (lid: string, fid: string, geomType: string) => {
            const resolver = (resolve: () => void, reject) => {
                let featureType: RecordType;
                let queryName: string;

                if ('point' === geomType) {
                    featureType = RecordType.Entity;
                }
                else if ('linestring' === geomType) {
                    featureType = RecordType.Path;
                }
                else if ('polygon' === geomType) {
                    featureType = RecordType.Spread;
                }
                queryName = RecordType[featureType] + 'Delete';

                persistentClient().query(queryName, [fid])
                    .then(() => {
                        resolve();
                        cacheStore.update(featureType, CacheStoreAction.Delete, {
                            id: fid,
                            layer_id: lid,
                            properties: {}
                        });
                    })
                    .catch(reject);
            };

            return new Promise<void>(resolver);
        };


        const delComposition = (id: string) => {
            const resolver = (resolve: () => void, reject) => {
                persistentClient()
                    .query('compositionDelete', [id])
                    .then(function () {
                        resolve();
                        cacheStore.update(RecordType.Composition, CacheStoreAction.Delete, {
                            id: id,
                            properties: {}
                        });
                    })
                    .catch(reject);
            };

            return new Promise<void>(resolver);
        };


        const getGroup = (gid: string) => {
            const resolver = (resolve: (a: string) => void, reject) => {
                cacheStore
                    .get(gid)
                    .then(getJSON)
                    .then(resolve)
                    .catch(reject);
            };
            return (new Promise(resolver));
        };


        const lookupGroups = (term: string) => {
            const transform = (result) => {
                const response = result.response;
                const docs: any[] = response.docs;
                const objs: Promise<ModelData>[] = docs.reduce((acc, doc) => {
                    const groups: string[] = doc.groups || [];
                    groups.forEach((gid) => {
                        acc.push(get(RecordType.Group, gid));
                    });
                    return acc;
                }, []);

                return Promise.all(objs);
            };
            return (
                indexerClient()
                    .search(`*${term}*`)
                    .then(transform)
            );
        };


        const query = (qname: string, type: RecordType, args: any[]) => {
            return queryPersistent(qname, type, args);
        }


        return {
            get,
            set,
            setFeature,
            delFeature,
            delComposition,
            getGroup,
            lookupGroups,
            query
        };
    };


export const client = function () {
    return Cache();
};

logger('module loaded');
