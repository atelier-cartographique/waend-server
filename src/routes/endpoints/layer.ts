/*
 * routes/endpoints/layer.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import { HandlerSet, EndpointSet, ApiHandler } from './index';
import { client } from '../../lib/cache';
import { RecordType } from '../../lib/models';
import { notifyUpdate, notifyCreate } from '../../lib/notifier';

const handlers: HandlerSet = {
    // list: function (request, response) {
    //     const self = this;
    //     client()
    //         .getLayers(request.params.group_id)
    //         .then(function(results){
    //             self.paginate(results, request, response);
    //         })
    //         .catch(function(err){
    //             response.status(500).send(err);
    //         });
    // },

    get(request, response) {
        client()
            .get(RecordType.Layer, request.params.layer_id)
            .then((data) => {
                response.send(data);
            })
            .catch((err) => {
                response.status(404).send(err);
            });
    },


    post(request, response) {
        const groupId: string = request.params.group_id;
        const body = Object.assign({}, request.body, {
            user_id: request.user.id,
        });

        client()
            .set(RecordType.Layer, body)
            .then((layer) => {
                const compositionData = {
                    layer_id: layer.id,
                    group_id: groupId,
                    properties: {},
                };
                client()
                    .set(RecordType.Composition, compositionData)
                    .then((/* composition */) => {
                        response.status(201).send(layer);
                        notifyCreate('layer', groupId, layer);
                    });
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },


    put(request, response) {
        const layerId = request.params.layer_id;
        const body = Object.assign({}, request.body, {
            user_id: request.user.id,
            id: layerId,
        });
        client()
            .set(RecordType.Layer, body)
            .then((data) => {
                response.send(data);
                notifyUpdate('layer', layerId, data);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },
};


const endpoints: EndpointSet<typeof handlers> = [
    // {
    //     verb: 'get',
    //     handler: 'list',
    //     url: 'user/:user_id/group/:group_id/layer/',
    //     permissions: ['ownsGroupOrPublic'],
    // },

    {
        verb: 'get',
        handler: 'get',
        url: 'user/:user_id/group/:group_id/layer/:layer_id',
        permissions: ['ownsGroupOrPublic'],
    },

    {
        verb: 'post',
        handler: 'post',
        url: 'user/:user_id/group/:group_id/layer/',
        permissions: ['isAuthenticated', 'ownsGroupOrPublic'],
    },

    {
        verb: 'put',
        handler: 'put',
        url: 'user/:user_id/group/:group_id/layer/:layer_id',
        permissions: ['isAuthenticated', 'isLayerOwner'],
    }
];


export default { handlers, endpoints } as ApiHandler<typeof handlers>;
