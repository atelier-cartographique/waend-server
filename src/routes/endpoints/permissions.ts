/*
 * routes/index.js
 *
 *
 * Copyright (C) 2017  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import * as e from 'express';
import cache from '../../lib/cache';
import { RecordType } from '../../lib/models';

export type PermissionName =
    | 'anyPermission'
    | 'isAuthenticated'
    | 'isUser'
    | 'isGroupOwner'
    | 'isLayerOwner'
    | 'ownsGroupOrPublic'
    ;

export type Permission = (a: e.Request, b: e.Response, c: e.NextFunction) => void;
type PermissionTable = {
    [k in PermissionName]: Permission;
};

export const permissions: PermissionTable = {

    anyPermission(_request, _response, next) {
        next();
    },

    isAuthenticated(request, response, next) {
        if (request.user) {
            return next();
        }
        response.status(401).send('NOT AUTHENTICATED');
    },

    isUser(request, response, next) {
        const userId = request.params.user_id;
        if (request.user.id === userId) {
            return next();
        }
        response.status(403).send('NOT THE RIGHT USER');
    },

    isGroupOwner(request, response, next) {
        const groupId = request.params.group_id;
        const requestUserId = request.user.id;

        cache()
            .get(RecordType.Group, groupId)
            .then((group) => {
                if (requestUserId === group.user_id) {
                    return next();
                }
                response.status(403).send('NOT THE GROUP OWNER');
            })
            .catch((err) => {
                response.status(404).send(err.toString());
            });
    },

    isLayerOwner(request, response, next) {
        const layerId = request.params.layer_id;
        const requestUserId = request.user.id;

        cache()
            .get(RecordType.Layer, layerId)
            .then((layer) => {
                if (requestUserId === layer.user_id) {
                    return next();
                }
                response.status(403).send('NOT THE LAYER OWNER');
            })
            .catch((err) => {
                response.status(404).send(err.toString());
            });
    },

    ownsGroupOrPublic(request, response, next) {
        const groupId = request.params.group_id;
        const requestUserId = (request.user) ? request.user.id : 'x';
        cache()
            .get(RecordType.Group, groupId)
            .then((group) => {
                if ((0 === group.status_flag)
                    || (requestUserId === group.user_id)) {
                    return next();
                }
                response.status(403).send('NOT THE GROUP OWNER NOR A PUBLIC GROUP');
            })
            .catch((err) => {
                console.error('base.ownsGroupOrPublic err', err);
                response.status(404).send(err.toString());
            });
    },
};


