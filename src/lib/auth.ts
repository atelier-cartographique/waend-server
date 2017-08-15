/*
 * lib/auth.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as debug from 'debug';
import * as bcrypt from 'bcrypt';
import * as uuid from 'uuid';
import { client as cache } from './cache';
import { client as db } from './db';
import { QueryResult } from "pg";
import { ModelData } from "./models";


const logger = debug('lib/auth');


const getAuthenicatedUser = (authId: string) => {
    return db().query('userGetAuth', [authId]);
}


const comparePassword: (a: string) => (b: QueryResult) => Promise<string> =
    (password) => (qr) => {
        // fields = ['id', 'email', 'hash'];
        logger(`comparePassword ${qr.rows[0]}`)
        if (qr.rowCount < 1) {
            return Promise.reject(new Error('not a registered user'));
        }

        const hash: string = qr.rows[0].password;
        const id: string = qr.rows[0].id;

        const resolver =
            (resolve: (a: string) => void, reject: (e: Error) => void) => {
                bcrypt.compare(password, hash, (err, same) => {
                    if (err || !same) {
                        return reject(new Error('wrong password'));
                    }
                    resolve(id);
                })
            }

        return (new Promise(resolver));

    };


export type DoneFn = (a: Error | null, b: ModelData | null) => void;

export const verify = (email: string, password: string, done: DoneFn) => {
    const resolve = (result: any) => {
        if (result) {
            return done(null, result);
        }
        return done(new Error('wrong credentials'), null);
    };

    const reject = function (err: any) {
        return done(new Error(err), null);
    };

    return (
        db().query('authGetEmail', [email])
            .then(comparePassword(password))
            .then(getAuthenicatedUser)
            .then(result => result.rows[0])
            .then(resolve)
            .catch(reject));
};


const createUser = (name: string) => (qr: QueryResult) => {
    const user = {
        auth_id: qr.rows[0].id,
        properties: { name },
    };
    return cache().set('user', user);
};


const createAuth = (email: string) => (hash: string) => {
    // logger('auth.createAuth', email, hash);
    return db().query('authCreate', [uuid.v4(), email, hash]);
};

export const register = (email: string, password: string, name: string) => {
    const seededCreateAuth = createAuth(email);
    const seededCreateUser = createUser(name);

    return (
        bcrypt
            .genSalt(12)
            .then((salt) => bcrypt.hash(password, salt))
            .then<QueryResult>(seededCreateAuth)
            .then(seededCreateUser));
};


logger('module loaded');