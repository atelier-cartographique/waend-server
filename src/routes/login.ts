/*
 * routes/login.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */


import * as e from 'express';
import * as passport from 'passport';
import { register as authRegister } from '../lib/auth';
import { put as putToken } from '../lib/token';


const authOptions = {
    failureRedirect: '/login?failed=1',
};


const authenticate = passport.authenticate('local', authOptions);

const getToken =
    (req: e.Request, res: e.Response) => {
        const t = putToken(req.user);
        res.json(t);
    };

const postLogin =
    (_req: e.Request, res: e.Response) => {
        res.redirect('/');
    }

const postLogout =
    (req: e.Request, res: e.Response) => {
        req.logout();
        res.redirect('/');
    };

const renderLogin =
    (_req: e.Request, res: e.Response) => {
        res.render('login', { email: '' });
    };

const renderRegister =
    (_req: e.Request, res: e.Response) => {
        res.render('register');
    };

const register =
    (req: e.Request, res: e.Response) => {
        if (req.body) {
            const email = req.body.email;
            const password = req.body.password;
            const name = req.body.username;
            console.log('register', email, password);
            authRegister(email, password, name)
                .then((user) => {
                    req.login(user, (err) => {
                        if (err) {
                            console.error('auto login after register:', err);
                        }
                        res.redirect('/map');
                    });
                })
                .catch((error: Error) => {
                    console.error('register err', error);
                    res.status(500).render('registerFailed', { email, error });
                });
        }
        else {
            res.sendStatus(400);
        }
    };

const login =
    (router: e.Router) => {

        // GETs
        router.get('/login', renderLogin);
        router.get('/register', renderRegister);
        router.get('/token', getToken);


        // POSTs
        router.post('/login', authenticate, postLogin);
        router.post('/logout', postLogout);
        router.post('/register', register);
    };

export default login;
