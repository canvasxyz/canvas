# @canvas-js/chain-near

The NEAR session signer takes a `KeyPair` from `near-api-js` and uses it to authenticate a new session.

It also handles verification of messages matching this authentication method.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-near
```

## API

```ts
import { KeyPair } from "near-api-js";
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces";
import { NEARSessionData } from "./types.js";
export interface NEARSignerInit {
    chainId?: string;
    keyPair?: KeyPair;
    sessionDuration?: number;
}
export declare class NEARSigner implements SessionSigner {
    constructor({ keyPair, sessionDuration, chainId }?: NEARSignerInit);
    readonly match: (chain: string) => boolean;
    verifySession(topic: string, session: Session): void;
    getSession(topic: string, options?: {
        timestamp?: number;
        fromCache?: boolean;
    }): Promise<Session<NEARSessionData>>;
    sign(message: Message<Action | Session>): Signature;
    clear(topic: string): Promise<void>;
}
```