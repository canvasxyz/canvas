/// <reference types="node" />
import { Worker, MessagePort } from "node:worker_threads";
import { Feed } from "hypercore";
import * as sqlite from "better-sqlite3";
import { IPFSHTTPClient } from "ipfs-http-client";
import { Model } from "./models.js";
import { Action, Session } from "./actions.js";
export declare class App {
    readonly multihash: string;
    readonly database: sqlite.Database;
    readonly feed: Feed;
    readonly worker: Worker;
    readonly actionPort: MessagePort;
    readonly modelPort: MessagePort;
    readonly routes: Record<string, string>;
    readonly models: Record<string, Model>;
    readonly actionParameters: Record<string, string[]>;
    readonly handle: number | string;
    static initialize(options: {
        path: string;
        multihash: string;
        port?: number;
        ipfs?: IPFSHTTPClient;
    }): Promise<App>;
    private readonly statements;
    private readonly callPool;
    private readonly api;
    private readonly server;
    private readonly connections;
    sessions: Session[];
    private constructor();
    private handleModelMessage;
    private handleActionMessage;
    /**
     * 1. stop accepting new actions and queries
     * 2. reject in-process calls in the call pool
     * 3.
     */
    stop(): Promise<void>;
    /**
     * Create a new session.
     */
    session(session: Session): Promise<void>;
    /**
     * Apply an action.
     * There may be many outstanding actions, and actions are not guaranteed to execute in order.
     */
    apply(action: Action): Promise<void>;
}
