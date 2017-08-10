/*
 * routes/endpoints/index.js
 *     
 * 
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 * 
 * License in LICENSE file at the root of the repository.
 *
 */

//  var _ = require('underscore');

// var handlers = []; 
// var modelNames = ['user', 'group', 'layer', 'feature'];

//  _.each(modelNames, function(modelName){
//     var RH = require('./'+modelName);
//     var handler = new RH;
//     handlers.push(handler);
//  });


//  module.exports = exports = handlers;


import * as e from 'express';
import { PermissionName } from './permissions';
import { ModelData } from '../../lib/models';



type Verb = 'get' | 'post' | 'put' | 'delete' | 'head' | 'options';
type Handler = (a: e.Request, b: e.Response) => void;

export interface HandlerSet {
    [k: string]: Handler;
}

export interface Endpoint<HS extends HandlerSet> {
    verb: Verb;
    handler: keyof HS;
    url: string;
    permissions: PermissionName[];
}

export type EndpointSet<HS extends HandlerSet> = Endpoint<HS>[];

export interface ApiHandler<HS extends HandlerSet> {
    endpoints: EndpointSet<HS>;
    handlers: HS;
}

const PAGE_SIZE = 64;
const DEFAULT_PAGE = 0;

export const paginate =
    (result: ModelData[], request: e.Request, response: e.Response) => {
        const page = parseInt(request.query.page, 10) || DEFAULT_PAGE;
        const pageSize = parseInt(request.query.page_size, 10) || PAGE_SIZE;
        const offset = pageSize * page;
        const len = result.length;
        const pResult = result.slice(offset, offset + pageSize);

        // logger('base.paginate', offset, offset + page);
        // logger(pResult);

        response.status(200).send({
            page,
            pageSize,
            totalCount: len,
            pageCount: Math.ceil(len / pageSize),
            results: pResult,
        });
    };
