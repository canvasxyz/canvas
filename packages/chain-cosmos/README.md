# @canvas-js/chain-cosmos

The Cosmos session signer takes an injected Cosmos signer, which may be an `EthereumSigner`, `AminoSigner`, or `BytesSigner`, and uses it to authenticate a new session.

It also handles verification of messages matching any of these authentication methods.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-cosmos
```

## API

```ts
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces";
import { CosmosSessionData, ExternalCosmosSigner } from "./types.js";
export interface CosmosSignerInit {
    signer?: ExternalCosmosSigner;
    sessionDuration?: number;
    bech32Prefix?: string;
}
export declare class CosmosSigner implements SessionSigner {
    constructor({ signer, sessionDuration, bech32Prefix }?: CosmosSignerInit);

    readonly match: (address: string) => boolean;
    verifySession(topic: string, session: Session): Promise<void>;
    getSession(topic: string, options?: {
        timestamp?: number;
        fromCache?: boolean;
    }): Promise<Session<CosmosSessionData>>;
    sign(message: Message<Action | Session>): Signature;
    clear(topic: string): Promise<void>;
}
```