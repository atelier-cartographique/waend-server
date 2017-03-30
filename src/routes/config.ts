/*
 * routes/config.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

const config = require('../config');


module.exports = function configure(router) {
    router.get('/config/:key', (req, res) => {
        const key = req.params.key;
        res.set('Content-Type', 'application/javascript');
        const configData = config.public || {};
        const data = configData[key];
        res.send(data);
    });
};
