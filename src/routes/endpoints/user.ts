/*
 * routes/endpoints/user.js
 *     
 * 
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 * 
 * License in LICENSE file at the root of the repository.
 *
 */

import * as debug from 'debug';
import { HandlerSet, EndpointSet, ApiHandler } from './index';
import { client } from '../../lib/cache';

const logger = debug('waend:routes/user');

const handlers: HandlerSet = {
    get(request, response) {
        client()
            .get('user', request.params.user_id)
            .then((data) => {
                response.send(data);
            })
            .catch((err) => {
                response.status(404).send(err);
            });
    },

    put(request, response) {
        const body = request.body;
        logger(body);
        client()
            .set('user', body)
            .then((data) => {
                response.send(data);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },

    getMe(req, res) {
        client()
            .get('user', req.user.id)
            .then((data) => {
                res.send(data);
            })
            .catch((err) => {
                res.status(500).send(err);
            });
    },
};

const endpoints: EndpointSet<typeof handlers> = [
    {
        verb: 'get',
        handler: 'getMe',
        url: 'auth',
        permissions: ['isAuthenticated'],
    },
    {
        verb: 'get',
        handler: 'get',
        url: 'user/:user_id',
        permissions: [],
    },
    {
        verb: 'put',
        handler: 'put',
        url: 'user/:user_id',
        permissions: ['isAuthenticated', 'isUser'],
    },
];

export default { handlers, endpoints } as ApiHandler<typeof handlers>;

logger('loaded');
