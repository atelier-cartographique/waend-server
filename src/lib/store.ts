/*
 * lib/store.js
 *
 *
 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as Promise from 'bluebird';
import * as redis from 'redis';
import * as debug from 'debug';
// weird
import levelup = require('levelup');


const log = debug('waend:store');

type PutFn = (key: string, data: string) => Promise<string>;
type GetFn = (key: string) => Promise<string>;

export interface IStore {
    put: PutFn;
    get: GetFn;
}

interface MemData {
    [key: string]: any;
}

const MemoryStore: () => IStore =
    () => {
        const data: MemData = {};

        const put: PutFn = (key, value) => {
            data[key] = value;
            return Promise.resolve(key);
        };

        const get: GetFn = (key) => {
            if (key in data) {
                return Promise.resolve(data[key]);
            }
            return Promise.reject(key);
        };

        return { put, get };
    };

type RedisCallback = redis.Callback<string>;
type RedisResolveKey = (a: string) => void;
type RedisResolveData = (a: string) => void;
type RedisReject = (a: Error) => void;

const RedisStore: (a: number, b?: string) => IStore =
    (port, host) => {
        const redisClient = redis.createClient(port, host);

        const put: PutFn = (key, value) => {
            const resolver = (resolve: RedisResolveKey, reject: RedisReject) => {
                const cb: RedisCallback = (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(key);
                };
                redisClient.set(key, value, cb);
            };
            return (new Promise(resolver));
        };

        const get: GetFn = (key) => {
            const resolver = (resolve: RedisResolveData, reject: RedisReject) => {
                const cb: RedisCallback = (err, r) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(r);
                };
                redisClient.get(key, cb);
            };
            return (new Promise(resolver));
        };

        return { put, get };
    };


// type LevelCallback = (err: Error, r: string) => void;
type LevelResolveKey = (a: string) => void;
type LevelResolveData = (a: string) => void;
type LevelReject = (a: Error) => void;

const LevelStore: (a: string) => IStore =
    (path) => {
        const db = levelup(path);

        const put: PutFn = (key, value) => {
            const resolver = (resolve: LevelResolveKey, reject: LevelReject) => {
                db.put(key, value, (err) => {
                    if (err) return reject(err);
                    resolve(key);
                });
            };
            return (new Promise(resolver));
        };

        const get: GetFn = (key) => {
            const resolver = (resolve: LevelResolveData, reject: LevelReject) => {
                db.get(key, (err, value) => {
                    if (err) return reject(err);
                    resolve(<string>value);
                });
            };
            return (new Promise(resolver));
        };

        return { put, get };
    };

let store: IStore;

export const configure = (config: any) => {
    if (store) {
        return;
    }

    if ('level' in config) {
        store = LevelStore(config.level.path);
    }
    else if ('redis' in config) {
        store = RedisStore(config.redis.port, config.redis.host);
    }
    else {
        log(
            `
Using a memory store for cache,
may not be suitable for production use.
`,
        );
        store = MemoryStore();
    }
};


export const client = () => {
    if (!store) {
        throw (new Error('Store not configured'));
    }
    return store;
};
