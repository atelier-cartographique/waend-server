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
import indexer from './lib/indexer';
// import cache from './lib/cache';
// import notifier from './lib/notifier';
// import server from './lib/server';
// import routes from './routes';


const log = debug('waend:index');

nconf.argv({
    c: {
        alias: 'config',
        describe: 'configuration file path',
        demand: true,
        default: resolve('./config.json')
    }
});
nconf.env({ separator: '__' });

const start_server: (a: string) => void =
    (confPath) => {
        nconf.file(confPath);
        configureDB(nconf.get('pg'));
        configureStore(nconf.get('cache'));

        log('app started');
    }


start_server(nconf.get('c'));

// indexer.configure(config.solr);
// cache.configure();

// const app = server(config.server);
// routes(app);

// function postStart(optApp, optServer) {
//     notifier.configure(optServer, '/notify');
// }

// app.start(postStart);
