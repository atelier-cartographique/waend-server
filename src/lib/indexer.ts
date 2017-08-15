/**
 lib/indexer.js

 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 */


import * as debug from 'debug';
import * as Promise from 'bluebird';
import * as solr from 'solr-client';
import { ModelData, RecordType } from './models';

const logger = debug('waend:indexer');


type IndexerUpdate = (a: RecordType, b: string[], c: ModelData) => Promise<void>;
type IndexerUpdateBatch = (a: RecordType, b: string[], c: ModelData[]) => Promise<void>;
type IndexerSearch = (a: string) => Promise<any>;

export interface IIndexer {
    update: IndexerUpdate;
    updateBatch: IndexerUpdateBatch;
    search: IndexerSearch;
}


const Indexer: (a: solr.Client) => IIndexer =
    (client) => {

        const update: IndexerUpdate = (type, groups, model) => {
            return updateBatch(type, groups, [model]);
        };

        const updateBatch: IndexerUpdateBatch =
            (type, groups, models) => {
                const docs = models.map((model) => ({
                    type,
                    id: model.id,
                    groups: groups || [],
                    properties: model.properties
                }));

                if (docs.length > 0) {

                    const resolver: (a: () => void, b: (c: Error) => void) => void =
                        (resolve, reject) => {
                            client.add(docs, function (err) {
                                if (err) {
                                    logger(err);
                                    return reject(err);
                                }
                                client.commit();
                                resolve();

                            });
                        };

                    return (new Promise<void>(resolver));
                }
                return Promise.resolve();
            };


        const search: IndexerSearch =
            (term) => {
                const query = client.createQuery()
                    .q(term.toLowerCase())
                    .mm(1)
                    .qf({ name: 5, description: 3, content: 1 })
                    .edismax()
                    .start(0)
                    .rows(32 * 24);

                const resolver: (a: (d: any) => void, b: (c: Error) => void) => void =
                    (resolve, reject) => {
                        client.search(query, function (err, obj) {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve(obj);
                            }
                        });
                    };

                return (new Promise(resolver));
            };

        return { update, updateBatch, search };
    };



const NullIndexer: () => IIndexer =
    () => {
        return {
            update() {
                return Promise.resolve();
            },

            updateBatch() {
                return Promise.resolve();
            },

            search() {
                return Promise.resolve({});
            }
        }
    }

let indexer: IIndexer;

export const configure = (config?: any) => {
    if (indexer) {
        return
    }

    if (config) {
        var solrClient = solr.createClient(
            config.host, config.port, config.collection
        );
        solrClient.autoCommit = true;

        indexer = Indexer(solrClient);
    }
    else {
        indexer = NullIndexer();
    }
};


export const client = () => {
    if (!indexer) {
        throw (new Error('Indexer Not Configured'));
    }
    return indexer;
};

logger('module loaded');