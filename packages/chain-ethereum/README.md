# @canvas-js/chain-ethereum

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-ethereum
```

## API

```ts
import { AbstractSigner } from "ethers";
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces";
import type { SIWESessionData } from "./types.js";
export interface SIWESignerInit {
    chainId?: number;
    signer?: AbstractSigner;
    sessionDuration?: number;
}
export declare class SIWESigner implements SessionSigner<SIWESessionData> {
    constructor(init?: SIWESignerInit);
    readonly match: (address: string) => boolean;
    verifySession(topic: string, session: Session<SIWESessionData>): void;
    getSession(topic: string, options?: {
        timestamp?: number;
        fromCache?: boolean;
    }): Promise<Session<SIWESessionData>>;
    sign(message: Message<Action | Session>): Signature;
    clear(topic: string): Promise<void>;
}
```
