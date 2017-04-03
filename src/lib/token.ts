
/*
 * lib/token.ts
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as debug from 'debug';
import uuid from 'uuid';
import { ModelData } from "./models";

const logger = debug('waend:token');

export interface IToken {
    readonly id: string;
    readonly user: ModelData;
    readonly ts: number;
}

const defaultExpire = 1000 * 60;
const tokens = new Map<string, IToken>();

const Token: (a: ModelData) => IToken =
    (user) => {
        return {
            id: uuid.v4(),
            user: user,
            ts: Date.now(),
        }

    }


export const jsonToken = (token: IToken) => {
    return {
        user: token.user.id,
        token: token.id
    };
};



export const put = (user: ModelData) => {
    const t = Token(user);
    tokens.set(t.id, t);
    return t;
};

export const get = (tokId: string) => {
    if (tokens.has(tokId)) {
        const tok = tokens.get(tokId);

        return tok.user;
    }

    return null;
};


setInterval(() => {
    const limit = Date.now() - defaultExpire;
    const toDeleteList: string[] = [];

    tokens.forEach((tok, id) => {
        if (tok.ts < limit) {
            toDeleteList.push(id);
        }
    });

    toDeleteList.forEach((id) => { tokens.delete(id) });

}, 1000);


logger('module loaded');
