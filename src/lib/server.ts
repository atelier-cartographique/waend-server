/*
 * lib/server.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */




import { join } from 'path';
import * as express from 'express';
import * as morgan from 'morgan';
import * as passport from 'passport';
import * as favicon from 'serve-favicon';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as connectRedis from 'connect-redis';
import * as http from 'http';
import * as debug from 'debug';
import { Strategy } from 'passport-local';
import { verify } from './auth';
import { ModelData } from './models';
import { client as cacheClient } from './cache';

const logger = debug('waend:server');

const anonymousUser: ModelData = {
    id: 'anonymous',
    properties: {},
}

passport.serializeUser<ModelData, string>((user, done) => {
    done(null, user.id);
});

passport.deserializeUser<ModelData, string>((id, done) => {
    cacheClient()
        .get('user', id)
        .then((user) => {
            done(null, user);
        })
        .catch((err) => {
            // done(new Error('cannot find user'));
            done(null, anonymousUser);
            logger(`deserializeUser error: ${err}`);
        });
});

passport.use(new Strategy(verify));



export const configure =
    (config: { [prop: string]: any }) => {
        const app = express();
        Object.keys(config)
            .forEach((k) => {
                app.locals[k] = config[k];
                logger(`app.locals[${k}]`, config[k]);
            });


        // view engine setup
        app.set('views', config.views || join(__dirname, '../views'));
        app.set('view engine', config.viewEngine || 'jade');

        app.use(favicon(join(__dirname, '../../favicon.ico')));
        app.use(morgan('dev'));
        app.use(bodyParser.json({
            limit: config.bodyParserLimit || '400kb',
        }));
        app.use(bodyParser.urlencoded());
        app.use(cookieParser());
        app.use(express.static(config.static || join(__dirname, '../public')));

        if (!('session' in config)) {
            logger('We really need session support, update your config please');
            return process.exit(1);
        }

        const sessionConfig: session.SessionOptions = {
            secret: config.session.secret || 'xxxxxxxxx',
            resave: false,
            saveUninitialized: true,
        };

        if ('redis' in config.session) {
            const rconfig = config.session.redis;
            const redis = require('redis');
            const rclient = redis.createClient(rconfig.port, rconfig.host);
            const redisStore = connectRedis(session);
            sessionConfig.store = new redisStore({
                client: rclient,
            });
        }

        app.use(session(sessionConfig));
        app.use(passport.initialize());
        app.use(passport.session());

        app.set('port', process.env.PORT || config.port || 3000);

        const start =
            (postStart?: (a: Express.Application, b: http.Server) => void) => {
                // app.use(fof);
                const server = app.listen(app.get('port'), () => {
                    logger('Express server listening on port ' + server.address().port);
                    if (postStart) {
                        postStart(app, server);
                    }
                });
            };

        return { app, start };
    };

logger('loaded');
