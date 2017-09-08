/*
 * lib/db.js
 *
 *
 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as Promise from 'bluebird';
import * as debug from 'debug';
import * as pg from 'pg';
import Q, { IQueries } from './queries';


export interface IClient {
    query: (a: string, b: any[]) => Promise<pg.QueryResult>;
}

const logger = debug('waend:db');
const logError = debug('[ERROR] waend:db');


let pool: pg.Pool;
let queries: IQueries;

/**
 * A function that executes a named query
 *
 */
const query: (a: string, b: any[]) => Promise<pg.QueryResult> =
    (queryName, params) => {
        const sql = queries.sql(queryName, params);
        if (!sql) {
            return Promise.reject(new Error('Query does not exists or invalid parameters'));
        }

        const resolver: (a: (c: pg.QueryResult) => void, b: (d: Error) => void) => void =
            (resolve, reject) => {
                // might look a bit weird to wrap in another Promise
                // but we really want bluebird niceties
                logger(`QUERY \`${sql}\` [${params}]`);
                pool.query(sql, params).then(resolve, reject);
            };
        return (new Promise(resolver));
    };



export const configure: (a: any) => void =
    (config) => {
        if (pool) {
            return;
        }
        pool = new pg.Pool(config);
        pool.on('error', function (err) {
            logError(`idle client error ${err.message}`);
            logError(err.stack);
        });

        pool.on('connect', () => {
            logger('PG:Pool connected');
        });

        queries = Q(config.prefix, config.schema);
    };


export const client: () => IClient =
    () => {
        if (!pool) {
            throw (new Error('Database not configured'));
        }
        return { query };
    };

logger('module loaded');
