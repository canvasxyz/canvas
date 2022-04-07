import * as t from "io-ts";
import type { Model } from "./models.js";
/**
 * Actions
 *
 * An `ActionArgument` is a type-level representation of concrete action argument
 * types, ie TypeScript types that describe the possible JavaScript values that
 * we put into and get out of action calls.
 *
 * An `ActionPayload` is the data signed by the user, either directly or using a
 * session key.
 *
 * An `Action` holds an ActionPayload, its signature, and metadata needed to
 * establish the validity of the signature.
 *
 * Sessions
 *
 * A `SessionPayload` is the data signed by the user to initiate a session.
 *
 * A `Session` holds an ActionPayload, its signature, and metadata needed to
 * establish the validity of the session.
 *
 */
export declare type ActionArgument = null | boolean | number | string;
export declare const actionArgumentType: t.Type<ActionArgument>;
export declare type ActionPayload = {
    from: string;
    spec: string;
    call: string;
    args: ActionArgument[];
    timestamp: number;
};
export declare const actionPayloadType: t.Type<ActionPayload>;
export declare type Action = {
    from: string;
    session: string | null;
    chainId: string;
    signature: string;
    payload: string;
};
export declare const actionType: t.Type<Action>;
/**
 * Sessions
 */
export declare type Session = {
    from: string;
    signature: string;
    payload: string;
    session_public_key: string;
};
export declare const sessionType: t.Type<Session>;
export declare type SessionPayload = {
    from: string;
    spec: string;
    timestamp: number;
    metadata: string;
    session_public_key: string;
};
export declare const sessionPayloadType: t.Type<SessionPayload>;
export declare const _sessions: Model;
