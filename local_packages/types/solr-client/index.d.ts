// Type definitions for solr-client 0.6
// Project: https://github.com/lbdremy/solr-node-client#readme
// Definitions by: My Self <https://github.com/me>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped


/// <reference types="node" />
import * as http from 'http';

export type SolrVersion = '3.2' | '4.0' | '5.0' | '5.1';

export function createClient(host: string, port: number | string, core?: string, path?: string, agent?: http.Agent, secure?: boolean, bigint?: boolean, solrVersion?: SolrVersion): Client;

export interface ClientAddOptions {
    [k: string]: any;
}

export type ClientAddCallback = (err: any, b: any) => void;

export interface Client {
    autoCommit: boolean;
    add(doc: any, options: ClientAddOptions, callback: ClientAddCallback): any;
    add(doc: any, callback: ClientAddCallback): any;
    update(doc: any, options: ClientAddOptions, callback: ClientAddCallback): any;
    commit(): void;
    search(query: Query | Object | string, callback: (err: Error, obj: any) => void): http.ClientRequest;
    createQuery(): Query;
}


export interface Query {
    q(q: object | string): Query;
    qop(op: string): Query;
    df(df: string): Query;
    start(start: number): Query;
    rows(rows: number): Query;
    edismax(): Query;
    qf(options: any): Query;
    mm(mm: number): Query;
    // ...
}

