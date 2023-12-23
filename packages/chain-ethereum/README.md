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
import type { AbstractSigner } from "ethers"
import type { Signature, SessionSigner, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"

export type SIWESessionData = {
  signature: Uint8Array
  domain: string
  nonce: string
}

export interface SIWESignerInit {
  signer?: AbstractSigner
  store?: SessionStore
  sessionDuration?: number
}

export declare class SIWESigner implements SessionSigner {
  constructor(init?: SIWESignerInit)

  public match(chain: string): boolean
  public verifySession(session: Session): void
  public getSession(topic: string, options?: { chain?: string; timestamp?: number, fromCache?: boolean }): Promise<Session<SIWESessionData>>
  public sign(message: Message<Action | Session>): Signature
  public clear(): Promise<void>
}
```
