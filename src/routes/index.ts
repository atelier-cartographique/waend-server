/*
 * routes/index.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as express from 'express';
import config from './config';
import login from './login';
import api from './api';
import media from './media';
import applications from './applications';
import renderers from './renderers';
import fonts from './fonts';


const configure =
    (app: express.Application) => {
        const router = express.Router();

        config(router, app);
        login(router);
        api(router);
        media(router, app);
        applications(app.locals.applications, router);
        renderers(app.locals.renderers, router);
        fonts(app.locals.fontDir, router);

        app.use(router);
    };

export default configure;
