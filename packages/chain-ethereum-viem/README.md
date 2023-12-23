# @canvas-js/chain-ethereum-viem

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-ethereum-viem
```

## API

```ts
import { WalletClient } from "viem";
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces";
import type { SIWESessionData } from "./types.js";
export interface SIWESignerViemInit {
    chainId?: number;
    signer?: WalletClient;
    sessionDuration?: number;
}
export declare class SIWESignerViem implements SessionSigner<SIWESessionData> {
    constructor(init?: SIWESignerViemInit);
    readonly match: (address: string) => boolean;
    verifySession(topic: string, session: Session<SIWESessionData>): Promise<void>;
    getSession(topic: string, options?: {
        timestamp?: number;
        fromCache?: boolean;
    }): Promise<Session<SIWESessionData>>;
    sign(message: Message<Action | Session>): Signature;
    clear(topic: string): Promise<void>;
}
```
