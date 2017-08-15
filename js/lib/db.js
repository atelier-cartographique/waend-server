"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Promise = require("bluebird");
const debug = require("debug");
const pg = require("pg");
const queries_1 = require("./queries");
const logger = debug('waend:db');
const logError = debug('[ERROR] waend:db');
let pool;
let queries;
const query = (queryName, params) => {
    const sql = queries.sql(queryName, params);
    if (!sql) {
        return Promise.reject(new Error('Query does not exists or invalid parameters'));
    }
    const resolver = (resolve, reject) => {
        pool.query(sql, params).then(resolve, reject);
    };
    return (new Promise(resolver));
};
exports.configure = (config) => {
    if (pool) {
        return;
    }
    pool = new pg.Pool(config);
    pool.on('error', function (err) {
        logError(`idle client error ${err.message}`);
        logError(err.stack);
    });
    queries = queries_1.default(config.prefix, config.schema);
};
exports.client = () => {
    if (!pool) {
        throw (new Error('Database not configured'));
    }
    return { query };
};
logger('module loaded');
//# sourceMappingURL=db.js.map