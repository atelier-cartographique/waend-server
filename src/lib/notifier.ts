/*
 * lib/notifier.ts
 *
 *
 * Copyright (C) 2014  Pierre Marchand <pierremarc07@gmail.com>
 *
 * License in LICENSE file at the root of the repository.
 *
 */

import * as debug from 'debug';
import * as http from 'http';
import * as uuid from 'uuid';
import * as sockjs from 'sockjs';
import { get } from './token';
import { ModelData } from './models';

const logger = debug('waend:notifier');



interface IHandlers {
    auth(a: IState, b: string, c: string): void;
    sub(a: IState, b: string, c: string): void;
}


export type ChanType =
    | 'user'
    | 'group'
    | 'layer'
    | 'feature'
    ;


export interface IChannel {
    id: string;
    type: ChanType;
}

interface IState {
    readonly id: string;
    setUser(a: ModelData): void;
    getUser(): ModelData | null;
    getChannels(): IChannel[];
    write: (a: string) => void;
}

interface IStateVec {
    each: (fn: (a: IState) => void) => void;
    eachChannel: (chan: IChannel, fn: (a: IState) => void) => void;
    eachUser: (uid: string, fn: (a: IState) => void) => void;
    removeState: (state: IState) => void;
    create: (sock: sockjs.Connection) => IState;
}

type IStateVecCb = (a: IStateVec) => void;
type IStateVecFn = (a: IStateVecCb) => void;

const authUser =
    (state: IState, _uid: string, tok: string) => {
        const user = get(tok);
        if (user) {
            state.setUser(user);
        }
    };

const subscribe =
    (state: IState, type: ChanType, id: string) => {
        const channels = state.getChannels();
        const hasChannel = channels.findIndex(c => c.type === type && c.id === id);
        if (hasChannel < 0) {
            channels.push(createChannel(type, id));
        }
    };

const handlers: IHandlers = {
    auth: authUser,
    sub: subscribe,
};

export const createChannel =
    (type: ChanType, id: string) => {
        return {
            type,
            id,
        };
    };





const createState: (a: sockjs.Connection, b: (c?: IState) => void) => IState =
    (sock, done) => {
        const channels: IChannel[] = [];
        let user: ModelData | null = null;

        const reference: IState = {
            id: uuid.v4(),

            setUser(u: ModelData) {
                user = u;
            },

            getUser() {
                return user;
            },

            getChannels() {
                return channels;
            },

            write(msg: string) {
                sock.write(msg);
            },
        };


        const dispatch = (name: string, arg0: string, arg1: string) => {
            switch (name) {
                case 'auth':
                    handlers.auth(reference, arg0, arg1);
                    break;

                case 'sub':
                    handlers.sub(reference, arg0, arg1);
                    break;

                default:
                    break;
            }
        };

        sock.on('close', () => {
            done(reference);
        });

        sock.on('data', (message) => {
            let data;
            try {
                data = JSON.parse(message);
            }
            catch (e) {
                sock.close('400', 'Expect well formed JSON data string');
                done();
                return;
            }

            if (Array.isArray(data) && data.length === 3) {
                dispatch(data[0], data[0], data[1]);
            }
        });

        return reference;
    };


const nonNull =
    <T>(vs: (T | null)[]): T[] => {
        return (vs.filter(v => v !== null)) as T[];
    };

const stateVec =
    (): IStateVec => {
        const states: (IState | null)[] = [];
        const freeIndex: number[] = [];


        const eachChannel =
            (chan: IChannel, fn: (a: IState) => void) => {
                const { type, id } = chan;
                nonNull(states)
                    .forEach((state) => {
                        const idx = state.getChannels().findIndex(c => c.type === type && c.id === id);
                        if (idx >= 0) {
                            fn(state);
                        }
                    });
            };

        const eachUser =
            (uid: string, fn: (a: IState) => void) => {
                nonNull(states)
                    .forEach((state) => {
                        const user = state.getUser();
                        if (user && user.id === uid) {
                            fn(state);
                        }
                    });
            };

        const each =
            (fn: (a: IState) => void) => {
                nonNull(states).forEach(fn);
            };


        const removeState =
            (state: IState) => {
                const { id } = state;
                const idx = nonNull(states).findIndex(s => s.id === id);
                if (idx) {
                    states[idx] = null;
                    freeIndex.push(idx);
                }
            };


        const create =
            (sock: sockjs.Connection) => {
                const state = createState(sock, removeState);
                const idx = freeIndex.pop();
                if (idx) {
                    states[idx] = state;
                }
                else {
                    states.push(state);
                }
                return state;
            };


        return {
            each,
            eachChannel,
            eachUser,
            removeState,
            create,
        };

    };


let configured = false;
let withStates: (null | IStateVecFn) = null;

export const configure =
    (server: http.Server, prefix: string) => {
        if (configured) {
            throw (new Error('Notify Server already in use'));
        }

        const notifyServer = sockjs.createServer();
        const states = stateVec();
        withStates = (f) => { f(states); };

        notifyServer.on('connection', (sock) => {
            states.create(sock);
        });

        notifyServer.installHandlers(server, { prefix });
        configured = true;
    };



// module.exports.broadcast = function (data){
//     checkNotifier();
//     const chan = new Channel('*', '*'),
//         msg = JSON.stringify([chan.getPack(), data]);
//
//     function notify (state) {
//         state.sock.write(msg);
//     }
//
//     states.each(notify);
// };

/////////////////
// few helpers //
/////////////////


export const notifyUpdate =
    (chanType: ChanType, chanId: string, data: ModelData) => {
        const chan = createChannel(chanType, chanId);
        sendChannel(chan, 'update', data);
    };

export const notifyCreate =
    (chanType: ChanType, chanId: string, data: ModelData) => {
        const chan = createChannel(chanType, chanId);
        sendChannel(chan, 'create', data);
    };

export const notifyDelete =
    (chanType: ChanType, chanId: string, id: string) => {
        const chan = createChannel(chanType, chanId);
        sendChannel(chan, 'delete', id);
    };


export const sendChannel =
    (chan: IChannel, action: string, data: string | ModelData) => {
        if (withStates) {
            withStates((states) => {
                const msg = JSON.stringify([chan, action, data]);
                states.eachChannel(chan, (state) => {
                    state.write(msg);
                });
            });
        }
    };

logger('module loaded');
