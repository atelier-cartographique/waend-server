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
import uuid from 'uuid';
import * as sockjs from 'sockjs-node';
import { put, get } from './token';
import { ModelData } from "./models";

const logger = debug('waend:notifier');


const authUser = (state, uid, tok) => {
    state.user = get(tok);
};

const subscribe = (state, type, id) => {
    if (!(type in state.channels)) {
        state.channels[type] = [];
    }
    state.channels[type].push(id);
    state.channels[type] = _.uniq(state.channels[type]);
};

interface IHandlers {
    auth(a: IState, b: string, c: string): void;
    sub(a: IState, b: string, c: string): void;
}

const handlers: IHandlers = {
    auth: authUser,
    sub: subscribe
};

export enum ChanType {
    user,
    group,
    layer,
    feature,
}

export interface IPack {
    id: string;
    type: string;
}

export interface IChannel {
    id: string;
    type: ChanType;
    getPack(): IPack;
}

export const Channel = (type: ChanType, id: string) => {
    return {
        getPack() { return { type: ChanType[type], id }; },
        type,
        id,
    }
}


/////////////////
// few helpers //
/////////////////


export const update = (chanType: ChanType, chanId: string, data: any) => {
    const chan = Channel(chanType, chanId);
    sendChannel(chan, 'update', data);
};

module.exports.create = function (chanType, chanId, data) {
    const chan = new Channel(chanType, chanId);
    exports.sendChannel(chan, 'create', data);
};

module.exports.delete = function (chanType, chanId, id) {
    const chan = new Channel(chanType, chanId);
    exports.sendChannel(chan, 'delete', id);
};

type ChannelMap = Map<ChanType, IChannel>;

interface IState {
    setUser(a: ModelData): void;
    getChannels(): ChannelMap;
}

const State: (a: sockjs.Connection, b: (c: IState) => void) => IState =
    (sock, done) => {
        const id = uuid.v4();
        const channels = new Map<ChanType, IChannel>();
        let ready = false;
        let user: ModelData = null;

        const reference = {
            setUser(u: ModelData) {
                user = u;
            },

            getChannels() {
                return channels;
            }
        }

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

        sock.on('data', function (message) {
            let data;
            try {
                data = JSON.parse(message);
            }
            catch (e) {
                sock.close(400, 'Expect well formed JSON data string');
                that.done();
                return;
            }

            dispatch(data);
        });

        return reference;
    };

function StateVec() {
    this.states = [];
    this.freeIndex = [];
}

StateVec.prototype.eachChannel = function (chan, fn, ctx) {
    const states = this.states;
    for (const i = 0; i < states.length; i++) {
        if (states[i]) {
            const state = states[i],
                channels = state.channels;
            if (chan.type in channels) {
                if (_.indexOf(channels[chan.type], chan.id) >= 0) {
                    fn.call(ctx, state);
                }
            }
        }
    }
};

StateVec.prototype.eachUser = function (uid, fn, ctx) {
    const states = this.states;
    for (const i = 0; i < states.length; i++) {
        if (states[i]) {
            const state = states[i],
                id = state.user ? state.user.id : null;
            if (uid === id) {
                fn.call(ctx, state);
            }
        }
    }
};

StateVec.prototype.each = function (fn, ctx) {
    const states = this.states;
    for (const i = 0; i < states.length; i++) {
        if (states[i]) {
            const state = states[i];
            fn.call(ctx, state);
        }
    }
};


StateVec.prototype.removeState = function (state) {
    const id = state.id,
        states = this.states,
        idx = _.findIndex(states, function (s) {
            if (s) {
                return s.id === id;
            }
        });
    states[idx] = null;
    this.freeIndex.push(idx);
};

StateVec.prototype.create = function (sock) {
    const state = State(sock, this.removeState.bind(this));
    if (this.freeIndex.length > 0) {
        const idx = this.freeIndex.pop();
        this.states[idx] = state;
    }
    else {
        this.states.push(state);
    }
    return state;
};






let notifyServer: sockjs.Server;
let states;

module.exports.configure = function (server, prefix) {
    if (notifyServer) {
        throw (new Error('Notify Server already in use'));
    }

    notifyServer = sockjs.createServer();
    states = new StateVec();
    notifyServer.on('connection', function (sock) {
        states.create(sock);
    });

    notifyServer.installHandlers(server, { prefix: prefix });
};

function checkNotifier() {
    if (!notifyServer || !states) {
        throw (new Error('Called Notify Server when not configured'));
    }
}

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

export const sendChannel = (chan: IChannel, ) {
    checkNotifier();
    const chan = arguments[0],
        args = [chan.getPack()];
    for (const i = 1; i < arguments.length; i++) {
        args.push(arguments[i]);
    }

    const msg = JSON.stringify(args);

    function notify(state) {
        state.sock.write(msg);
    }

    states.eachChannel(chan, notify);
};

logger('module loaded');
