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
import type { AbstractSigner } from "ethers"
import type { Signature, SessionSigner, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"

export type SIWESessionData = {
  signature: Uint8Array
  domain: string
  nonce: string
}

export interface SIWESignerViemInit {
  signer?: AbstractSigner
  store?: SessionStore
  sessionDuration?: number
}

export declare class SIWESignerViem implements SessionSigner {
  constructor(init?: SIWESignerViemInit)

  public match(chain: string): boolean
  public verifySession(session: Session): void
  public getSession(topic: string, options?: { chain?: string; timestamp?: number, fromCache?: boolean }): Promise<Session<SIWESessionData>>
  public sign(message: Message<Action | Session>): Signature
  public clear(): Promise<void>
}
```
