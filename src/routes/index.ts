/*
 * routes/index.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

const express = require('express');
const login = require('./login');
const api = require('./api');
const media = require('./media');
const config = require('./config');

module.exports = function configure(app) {
    const router = express.Router();

    login(router, app);
    api(router, app);
    media(router, app);
    config(router, app);

    /* GET home page. */
    router.get('/', (req, res) => {
        res.redirect('/map');
    });

    router.get('/console*', (request, response) => {
        response.render('console');
    });

    router.get('/view*', (request, response) => {
        response.render('view');
    });

    router.get('/embed*', (request, response) => {
        response.render('embed');
    });

    router.get('/map*', (request, response) => {
        if (request.isAuthenticated()) {
            response.render('map', {
                user: request.user,
            });
        } else {
            response.render('map', {
                user: null,
            });
        }
    });


    app.use('/', router);
};
