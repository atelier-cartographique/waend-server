/*
 * routes/media.js
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */



import * as debug from 'debug';
import { readFile, writeFile, exists } from 'fs';
import { join } from 'path';
import * as e from 'express';
import * as multer from 'multer';
import * as magick from 'imagemagick-native';
import * as mkdirp from 'mkdirp';
import cache from '../lib/cache';
import { paginate } from './endpoints/index';


const logger = debug('waend:routes/media');


const ORIGINAL_NAME = 'orig';
const FIELD_NAME = 'media';

const STEPS =
    [
        4,
        8,
        16,
        32,
        64,
        128,
        256,
        512,
        1024,
    ];

type RejectFn = (e: Error) => void;

const mkdir =
    (path: string) => {
        const resolver =
            (resolve: (a: string) => void, reject: RejectFn) => {
                mkdirp(path, (err, made) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(made);
                });
            };

        return (new Promise(resolver));
    };


// const getMediaInfo =
//     (f: Express.Multer.File) => {
//         const resolver =
//             (resolve: (a: magick.IIdentifyResult) => void, reject: RejectFn) => {
//                 magick.identify({
//                     srcData: f.buffer,
//                     ignoreWarnings: false,
//                 }, (err, result) => {
//                     if (err) {
//                         return reject(err);
//                     }
//                     resolve(result);
//                 })
//             };
//         return (new Promise(resolver));
//     };



const resize =
    (srcPath: string, destPath: string, step: number) => {
        logger('resize', srcPath, step);
        const options = {
            width: STEPS[step],
            height: STEPS[step],
            resizeStyle: 'aspectfit',
            format: 'PNG',
            strip: true,
        };

        const resolver =
            (resolve: (path: string) => void, reject: RejectFn) => {
                readFile(srcPath, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    magick.convert({ srcData: data, ...options }, (err, result) => {
                        if (err) {
                            return reject(err);
                        }
                        writeFile(destPath, result, (err) => {
                            if (err) {
                                return reject(err);
                            }
                            resolve(destPath);
                        });
                    });
                });
            };

        return (new Promise(resolver));

    };


const listMedia =
    (request: e.Request, response: e.Response) => {
        const userId = request.params.user_id;
        cache()
            .query('mediaList', 'media', [userId])
            .then((results) => {
                paginate(results, request, response);
            })
            .catch((err) => {
                response.status(500).send(err);
            });
    };


const getStep =
    (sz: number) => {
        const step = STEPS.reduce((acc, v) => {
            if (acc < 0) {
                if (sz < v) {
                    return acc;
                }
            }
            return acc;
        }, -1);

        return step;
    };

const getMedia =
    (rootDir: string) =>
        (request: e.Request, response: e.Response) => {
            const size = parseInt(request.params.size, 10);
            const userId = request.params.user_id;
            const mediaId = request.params.media_id;
            const step = getStep(size);
            const fn = step > 0 ? `${step}.png` : ORIGINAL_NAME;
            const path = join(rootDir, userId, mediaId, fn);

            cache()
                .get('media', mediaId)
                .then((rec) => {
                    if (rec.user_id === userId) {
                        exists(path, (itExists) => {
                            if (itExists) {
                                return response.sendFile(path);
                            }
                            const orig = join(rootDir, userId, mediaId, ORIGINAL_NAME);
                            if (orig === path) {
                                return response.sendStatus(400);
                            }
                            resize(orig, path, step)
                                .then(() => response.sendFile(path))
                                .catch(err => response.status(500).send(err));
                        });
                    }
                    else {
                        response.sendStatus(404);
                    }
                })
                .catch(() => response.sendStatus(404));

        };

const recordMedia =
    (userId: string, f: Express.Multer.File) => {
        return (
            cache()
                .set('media', {
                    user_id: userId,
                    properties: {
                        mimetype: f.mimetype,
                        originalname: f.originalname,
                        filesize: f.size,
                    },
                })
        );
    };

const storage =
    (rootDir: string) => {
        return multer.diskStorage({
            destination(req, file, callback) {
                recordMedia(req.user.id, file)
                    .then(rec => mkdir(join(rootDir, req.user.id, rec.id)))
                    .then(dest => callback(null, dest))
                    .catch(err => callback(err, ''));
            },

            filename() { return ORIGINAL_NAME; },
        });
    };

const configure =
    (router: e.Router, app: e.Application) => {
        const uploadDir: string = app.locals.mediaDir;
        logger(uploadDir);
        const dest = uploadDir ? uploadDir : join(__dirname, '../../uploads');
        const multerMiddleware = multer({ storage: storage(dest) }).array(FIELD_NAME);

        // GETs
        router.get('/media/:user_id', listMedia);
        router.get('/media/:user_id/:media_id/:size', getMedia(dest));

        // POST
        router.post('/media',
            (request, response, next) => {
                if (request.isAuthenticated()) {
                    next();
                }
                else {
                    response.sendStatus(403);
                }
            },
            multerMiddleware,
            (_request, response) => {
                response.sendStatus(201);
            },
        );
    };

export default configure;

logger('loaded');
