[Documentation](../../packages.md) / @canvas-js/chain-ethereum

# @canvas-js/chain-ethereum

The Ethers (v6) Ethereum signer takes an `ethers` signer, or generates a random `ethers.Wallet`,
and uses it to sign a SIWE message authenticating a new session.

It also handles verification of messages matching this standard, and can be used in
conjuction with `@canvas-js/chain-ethereum-viem`.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-ethereum
```

## API

```ts
import { AbstractSigner } from "ethers"
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces"
import type { SIWESessionData } from "./types.js"
export interface SIWESignerInit {
  chainId?: number
  signer?: AbstractSigner
  sessionDuration?: number
}
export declare class SIWESigner implements SessionSigner<SIWESessionData> {
  constructor(init?: SIWESignerInit)
  readonly match: (address: string) => boolean
  verifySession(topic: string, session: Session<SIWESessionData>): void
  getSession(
    topic: string,
    options?: {
      timestamp?: number
      fromCache?: boolean
    },
  ): Promise<Session<SIWESessionData>>
  sign(message: Message<Action | Session>): Signature
  clear(topic: string): Promise<void>
}
```
