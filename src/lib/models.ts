/**
 * lib/models.js
 *
 * Copyright (C) 2015  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 */

import uuid from 'uuid';
// import { Maybe } from 'monet';
// import wellknown from 'wellknown';


export interface ModelProperties {
    [propName: string]: any;
}

export interface BaseModelData {
    properties: ModelProperties;
    geom?: GeoJSON.GeoJsonObject;
    [propName: string]: any;
}

export interface ModelData extends BaseModelData {
    id: string,
}



export class Model {
    parse = JSON.parse;
    stringify = JSON.stringify;

    parameters: string[];

    prepare(obj: BaseModelData): ModelData {
        if ('id' in obj) {
            return <ModelData>{ ...obj };
        }
        return { id: uuid.v4(), ...obj };
    }


    getParameters(obj: ModelData): any[] {
        const p = this.parameters;
        return p.map((key) => {
            if ('geom' === key) {
                return JSON.stringify(obj[key]);
            }
            return obj[key];
        });
    }


    buildFromPersistent(row): ModelData {
        const p = this.parameters;
        const initial: ModelData = {
            properties: {},
            id: row.id
        };
        return (p.reduce<ModelData>((acc, key) => {
            if ('geom' === key) {
                acc[key] = JSON.parse(row[key]);
            }
            else {
                acc[key] = row[key];
            }

            return acc;
        }, initial));
    }
}


export class Entity extends Model {
    parameters = ['id', 'layer_id', 'user_id', 'properties', 'geom'];
}

export class Path extends Model {
    parameters = ['id', 'layer_id', 'user_id', 'properties', 'geom'];
}

export class Spread extends Model {
    parameters = ['id', 'layer_id', 'user_id', 'properties', 'geom'];
}

export class Layer extends Model {
    parameters = ['id', 'user_id', 'properties'];
}

export class User extends Model {
    parameters = ['id', 'auth_id', 'properties'];
}

export class Composition extends Model {
    parameters = ['id', 'layer_id', 'group_id'];
}

export class Group extends Model {
    parameters = ['id', 'user_id', 'status_flag', 'properties'];
}

