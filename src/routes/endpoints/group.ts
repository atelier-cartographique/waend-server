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
import { HandlerSet, EndpointSet, ApiHandler, paginate } from './index';
import { client } from '../../lib/cache';
import { notifyUpdate, notifyCreate } from '../../lib/notifier';

const logger = debug('waend:routes/endpoints/group');

// const logger = require('debug')('routes/endpoints/user'),
//     _ = require('underscore'),
//     base = require('./base'),
//     cache = require('../../lib/cache'),
//     notifier = require('../../lib/notifier');


const handlers: HandlerSet = {
    searchGroups(request, response) {
        client()
            .lookupGroups(request.params.term)
            .then((results) => {
                const data = results.filter(g => 0 === g.status_flag);
                paginate(data, request, response);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },

    get(request, response) {
        client()
            .getGroup(request.params.group_id)
            .then((data) => {
                response.send(data);
            })
            .catch((err) => {
                logger('get', err);
                response.status(404).send(err);
            });
    },

    list(request, response) {
        let listPrivate = false;
        if (request.user
            && (request.user.id === request.params.user_id)) {
            listPrivate = true;
        }
        client()
            .query('groupListForUser', 'group', [request.params.user_id])
            .then((results) => {
                if (listPrivate) {
                    paginate(results, request, response);
                }
                else {
                    const data = results.filter(g => 0 === g.status_flag);
                    paginate(data, request, response);
                }
            })
            .catch((err) => {
                logger('list error', err);
                response.status(500).send(err);
            });
    },

    post(request, response) {
        const uid: string = request.user.id;
        const body = Object.assign({},
            request.body, { user_id: uid });

        client()
            .set('group', body)
            .then((data) => {
                response.status(201).send(data);
                notifyCreate('group', uid, data);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },

    put(request, response) {
        const body = Object.assign({}, request.body, {
            user_id: request.user.id,
            id: request.params.group_id,
        });
        client()
            .set('group', body)
            .then((data) => {
                response.send(data);
                notifyUpdate('group', data.id, data);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },

    attach(request, response) {
        const body = request.body;
        const layerId = body.layer_id;
        const userId = request.user.id;

        client()
            .get('layer', layerId)
            .then((layer) => {
                if (layer.user_id !== userId) {
                    response.status(403).send('Not Your Layer');
                    return;
                }
                client()
                    .set('composition', body)
                    .then(() => {
                        response.status(201).end();
                    });
            })
            .catch((err) => {
                response.status(500).send(err);
            });

    },

    detach(request, response) {
        const groupId = request.params.group_id;
        const layerId = request.params.layer_id;
        const userId = request.user.id;

        client()
            .get('layer', layerId)
            .then((layer) => {
                if (layer.user_id !== userId) {
                    response.status(403).send('Not Your Layer');
                    return;
                }
                client()
                    .delComposition(groupId, layerId)
                    .then(() => {
                        response.status(204).end();
                    });
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },

    // layer(request, response) {

    // },

    // subscribe(request, response) {

    // },

    // unsubscribe(request, response) {

    // },


    // moveLayer(request, response) {

    // },
};


const endpoints: EndpointSet<typeof handlers> = [
    {
        verb: 'get',
        handler: 'searchGroups',
        url: 'group/:term',
        permissions: [],
    },

    {
        verb: 'get',
        handler: 'list',
        url: 'user/:user_id/group/',
        permissions: [],
    },

    {
        verb: 'get',
        handler: 'get',
        url: 'user/:user_id/group/:group_id',
        permissions: ['ownsGroupOrPublic'],
    },

    {
        verb: 'post',
        handler: 'post',
        url: 'user/:user_id/group/',
        permissions: ['isAuthenticated', 'isUser'],
    },

    {
        verb: 'put',
        handler: 'put',
        url: 'user/:user_id/group/:group_id',
        permissions: ['isAuthenticated', 'isUser', 'isGroupOwner'],
    },

    {
        verb: 'post',
        handler: 'attach',
        url: 'user/:user_id/group/:group_id/attach/',
        permissions: ['isAuthenticated'],
    },

    {
        verb: 'delete',
        handler: 'detach',
        url: 'user/:user_id/group/:group_id/detach/:layer_id',
        permissions: ['isAuthenticated'],
    },

];

export default { handlers, endpoints } as ApiHandler<typeof handlers>;

logger('loaded');
