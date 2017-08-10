/*
 * routes/endpoints/entity.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import { HandlerSet, EndpointSet, ApiHandler } from './index';
import { client } from '../../lib/cache';
import { notifyUpdate, notifyCreate, notifyDelete } from '../../lib/notifier';


const handlers: HandlerSet = {

    // list: function (request, response) {
    //     const self = this,
    //         bounds = _.mapObject(_.pick(request.query, 'n', 'e', 's', 'w'), function(v){ return parseFloat(v); });
    //     client()
    //         .getFeatures(request.params.layer_id, bounds)
    //         .then(function(results){
    //             self.paginate(results, request, response);
    //         })
    //         .catch(function(err){
    //             response.status(500).send(err);
    //         });
    // },

    // get: function (request, response) {
    //     client()
    //         .getFeature(request.params.feature_id)
    //         .then(function(data){
    //             response.send(data);
    //         })
    //         .catch(function(err){
    //             response.status(404).send(err);
    //         });
    // },


    post(request, response) {
        const layerId = request.params.layer_id;
        const body = Object.assign({}, request.body, {
            user_id: request.user.id,
        });

        client()
            .setFeature(body)
            .then((feature) => {
                response.status(201).send(feature);
                notifyCreate('layer', layerId, feature);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },


    put(request, response) {
        const layerId = request.params.layer_id;
        const body = Object.assign({}, request.body, {
            user_id: request.user.id,
            layer_id: layerId,
            id: request.params.feature_id,
        });
        client()
            .setFeature(body)
            .then((data) => {
                response.send(data);
                notifyUpdate('layer', layerId, data);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    },

    del(request, response) {
        const lid = request.params.layer_id;
        const fid = request.params.feature_id;
        const geomType = request.params.geom_type.toLowerCase();

        client()
            .delFeature(lid, fid, geomType)
            .then(() => {
                response.status(204).end();
                notifyDelete('layer', lid, fid);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    }

};

const endpoints: EndpointSet<typeof handlers> = [
    // endpoints: {

    //         list: {
    //             verb: 'get',
    //             handler: 'list',
    //             url: 'user/:user_id/group/:group_id/layer/:layer_id/feature/',
    //             permissions: ['ownsGroupOrPublic']
    //         },

    //         get: {
    //             verb: 'get',
    //             handler: 'get',
    //             url: 'user/:user_id/group/:group_id/layer/:layer_id/feature/:feature_id',
    //             permissions: ['ownsGroupOrPublic']
    //         },

    {
        verb: 'post',
        handler: 'post',
        url: 'user/:user_id/group/:group_id/layer/:layer_id/feature/',
        permissions: ['isAuthenticated', 'isLayerOwner'],
    },

    {
        verb: 'put',
        handler: 'put',
        url: 'user/:user_id/group/:group_id/layer/:layer_id/feature/:feature_id',
        permissions: ['isAuthenticated', 'isLayerOwner'],
    },

    {
        verb: 'delete',
        handler: 'del',
        url: 'user/:user_id/group/:group_id/layer/:layer_id/feature.:geom_type/:feature_id',
        permissions: ['isAuthenticated', 'isLayerOwner'],
    },
    //     },
];

export default { handlers, endpoints } as ApiHandler<typeof handlers>;

