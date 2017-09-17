/*
 * routes/api.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import * as debug from 'debug';
import * as e from 'express';
import { permissions as permissionHandlers } from './endpoints/permissions';
import user from './endpoints/user';
import group from './endpoints/group';
import layer from './endpoints/layer';
import feature from './endpoints/feature';

const logger = debug('waend:api');
const rootV1 = '/api/v1/';

const noCache =
    (_req: e.Request, res: e.Response, next: e.NextFunction) => {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        next();
    }

const configure =
    (router: e.Router) => {

        [
            user,
            group,
            layer,
            feature,
        ].forEach((api) => {
            const handlers = api.handlers;
            api.endpoints.forEach((endpoint) => {
                const { verb, handler, permissions } = endpoint;
                const route = router[verb].bind(router);
                const handlerMethod = handlers[handler];
                const perms = permissions.map(perm => permissionHandlers[perm]);

                route(`${rootV1}${endpoint.url}`, ...perms, noCache, handlerMethod);
            });
        });
    };

export default configure;

logger('loaded');
