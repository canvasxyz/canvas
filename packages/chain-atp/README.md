# @canvas-js/chain-atp

The Bluesky/AT Protocol session signer prompts the user for an app password, and uses it to generate a new signed post on Bluesky, authenticating a new session. The posted authentication message is then immediately deleted.

It also handles verification of messages matching this authentication method.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-atp
```

## API

```ts
import type { Action, Message, Session, SessionSigner, Signature } from "@canvas-js/interfaces";
import { Operation } from "./operation.js";

export type ATPSessionData = {
    verificationMethod: string;
    plcOperationLog: Operation[];
    recordArchive: Uint8Array;
    recordURI: string;
};

export interface ATPSignerOptions {
    login?: () => Promise<{
        identifier: string;
        password: string;
    }>;
}

export declare class ATPSigner implements SessionSigner<ATPSessionData> {
    constructor(options?: ATPSignerOptions);

    static createAuthenticationMessage(topic: string, publicKey: string, address: string): string;

    match: (address: string) => boolean;
    verifySession(topic: string, session: Session<ATPSessionData>): Promise<void>;
    getSession(topic: string, options?: {
        chain?: string;
        timestamp?: number;
        fromCache?: boolean;
    }): Promise<Session<ATPSessionData>>;
    sign(message: Message<Action | Session>): Signature;
    clear(topic: string): void;
}
```
