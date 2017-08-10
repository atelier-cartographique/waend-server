/*
 * index.ts
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import { resolve } from 'path';
import * as nconf from 'nconf';
import * as debug from 'debug';

import { configure as configureDB } from './lib/db';
import { configure as configureStore } from './lib/store';
import { configure as configureIndexer } from './lib/indexer';
import { configure as configureNotifier } from './lib/notifier';
import { configure } from './lib/server';
import routes from './routes';


const log = debug('waend:index');

nconf.argv({
    c: {
        alias: 'config',
        describe: 'configuration file path',
        demand: true,
        default: resolve('./config.json'),
    },
});
nconf.env({ separator: '__' });

const startServer: (a: string) => void =
    (confPath) => {
        nconf.file(confPath);
        configureDB(nconf.get('pg'));
        configureStore(nconf.get('cache'));
        configureIndexer(nconf.get('solr'));
        const { app, start } = configure(nconf.get('server'));
        routes(app);
        start((_optApp, optServer) => {
            configureNotifier(optServer, '/notify');
        });
        log('app started');
    };


startServer(nconf.get('c'));

