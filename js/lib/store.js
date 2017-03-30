"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const redis = require("redis");
const debug = require("debug");
const levelup = require("levelup");
const log = debug('waend:store');
const MemoryStore = () => {
    const data = {};
    const put = (key, value) => {
        data[key] = value;
        return Promise.resolve(key);
    };
    const get = (key) => {
        if (key in data) {
            return Promise.resolve(data[key]);
        }
        return Promise.reject(key);
    };
    return { put, get };
};
const RedisStore = (port, host) => {
    const redisClient = redis.createClient(port, host);
    const put = (key, value) => {
        const resolver = (resolve, reject) => {
            const cb = (err) => {
                if (err) {
                    return reject(err);
                }
                resolve(key);
            };
            redisClient.set(key, value, cb);
        };
        return (new Promise(resolver));
    };
    const get = (key) => {
        const resolver = (resolve, reject) => {
            const cb = (err, r) => {
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
const LevelStore = (path) => {
    const db = levelup(path);
    const put = (key, value) => {
        return (new Promise((resolve, reject) => {
            db.put(key, value, (err) => {
                if (err)
                    return reject(err);
                resolve(key);
            });
        }));
    };
    const get = (key) => {
        return (new Promise(function (resolve, reject) {
            db.get(key, function (err, value) {
                if (err)
                    return reject(err);
                resolve(value);
            });
        }));
    };
    return { put, get };
};
let store;
exports.configure = (config) => {
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
        log(`
Using a memory store for cache,
may not be suitable for production use.
`);
        store = MemoryStore();
    }
};
exports.client = () => {
    if (!store) {
        throw (new Error('Store not configured'));
    }
    return store;
};
