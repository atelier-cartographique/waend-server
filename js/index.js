"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const nconf = require("nconf");
const debug = require("debug");
const db_1 = require("./lib/db");
const store_1 = require("./lib/store");
const indexer_1 = require("./lib/indexer");
const notifier_1 = require("./lib/notifier");
const server_1 = require("./lib/server");
const routes_1 = require("./routes");
const log = debug('waend:index');
nconf.argv({
    c: {
        alias: 'config',
        describe: 'configuration file path',
        demand: true,
        default: path_1.resolve('./config.json'),
    },
});
nconf.env({ separator: '__' });
const startServer = (confPath) => {
    nconf.file(confPath);
    db_1.configure(nconf.get('pg'));
    store_1.configure(nconf.get('cache'));
    indexer_1.configure(nconf.get('solr'));
    const { app, start } = server_1.configure(nconf.get('server'));
    routes_1.default(app);
    start((_optApp, optServer) => {
        notifier_1.configure(optServer, '/notify');
    });
    log('app started');
};
startServer(nconf.get('c'));
//# sourceMappingURL=index.js.map