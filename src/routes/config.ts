/*
 * routes/config.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as e from 'express';

interface PublicConfig {
    [k: string]: string;
}

const configure =
    (router: e.Router, app: e.Application) => {
        const publicData: PublicConfig = app.locals.public;
        Object.keys(publicData)
            .forEach((key: string) => {
                router.get(`/config/${key}`, (_req, res) => {
                    res.set('Content-Type', 'application/javascript');
                    res.send(publicData[key]);
                });
            });
    };

export default configure;

