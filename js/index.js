"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const nconf = require("nconf");
const debug = require("debug");
const db_1 = require("./lib/db");
const store_1 = require("./lib/store");
const log = debug('waend:index');
nconf.argv({
    c: {
        alias: 'config',
        describe: 'configuration file path',
        demand: true,
        default: path_1.resolve('./config.json')
    }
});
nconf.env({ separator: '__' });
const start_server = (confPath) => {
    nconf.file(confPath);
    db_1.configure(nconf.get('pg'));
    store_1.configure(nconf.get('cache'));
    log('app started');
};
start_server(nconf.get('c'));
