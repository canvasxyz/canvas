[Documentation](../../packages.md) / @canvas-js/chain-ethereum-viem

# @canvas-js/chain-ethereum-viem

The Viem Ethereum signer takes a Viem `WalletClient`, or generates a random WalletClient,
and uses it to sign a SIWE message authenticating a new session.

It also handles verification of messages matching this standard, and can be used in
conjuction with `@canvas-js/chain-ethereum`.

## Table of Contents

- [Installation](#installation)
- [API](#api)

## Installation

```
npm i @canvas-js/chain-ethereum-viem
```

## API

```ts
import { WalletClient } from "viem"
import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces"
import type { SIWESessionData } from "./types.js"
export interface SIWESignerViemInit {
  chainId?: number
  signer?: WalletClient
  sessionDuration?: number
}
export declare class SIWESignerViem implements SessionSigner<SIWESessionData> {
  constructor(init?: SIWESignerViemInit)
  readonly match: (address: string) => boolean
  verifySession(topic: string, session: Session<SIWESessionData>): Promise<void>
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
