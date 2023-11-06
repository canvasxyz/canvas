# @canvas-js/interfaces

This package exports TypeScript types for Canvas messages and other interfaces.

## Table of Contents

- [Installation](#installation)
- [API](#api)
  - [Signatures](#signatures)
  - [Signers](#signers)
  - [Messages](#messages)
  - [Actions](#actions)
  - [Sessions](#sessions)
  - [Session signers](#session-signers)
  - [Utility types](#utility-types)
    - [Awaitable](#awaitable)

## Installation

```
npm i @canvas-js/chain-interfaces
```

## API

### Signatures

```ts
import type { CID } from "multiformats"

export type Signature = {
  publicKey: string
  signature: Uint8Array
  cid: CID
}
```

### Signers

```ts
import type { Signature } from "./Signature.js"

export interface Signer<T = any> {
  sign(value: T): Signature
}
```

### Messages

```ts
export type Message<Payload = unknown> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

### Actions

```ts
export type Action = {
  type: "action"

  /** DID or CAIP-2 address (e.g. "eip155:1:0xb94d27...") */
  address: string

  name: string
  args: any

  timestamp: number
  blockhash: string | null
}
```

### Sessions

```ts
export type Session<Data = any> = {
  type: "session"

  /** DID or CAIP-2 address (e.g. "eip155:1:0xb94d27...") */
  address: string

  /** did:key URI of the ephemeral session key used to sign subsequent actions */
  signingKey: string

  /** chain-specific session payload, e.g. a SIWE message & signature */
  data: Data
  duration: number | null

  timestamp: number
  blockhash: string | null
}
```

### Session signers

```ts
import type { Signer } from "./Signer.js"
import type { Message } from "./Message.js"
import type { Session } from "./Session.js"
import type { Action } from "./Action.js"
import type { Awaitable } from "./Awaitable.js"

export interface SessionSigner extends Signer<Message<Action | Session>> {
  match: (chain: string) => boolean

  /**
   * Produce an signed Session object, which authorizes `session.publicKey`
   * to represent the user `${session.chain}:${session.address}`.
   *
   * The signature is stored in `session.data`, and the entire Session
   * object is then signed using the session-key, and appended to our message log.
   */
  getSession: (topic: string, options?: { chain?: string; timestamp?: number }) => Awaitable<Session>

  /**
   * Verify that `session.data` authorizes `session.publicKey`
   * to take actions on behalf of the user `${session.chain}:${session.address}`
   */
  verifySession: (session: Session) => Awaitable<void>
}
```

### Utility types

#### `Awaitable`

```ts
export type Awaitable<T> = T | Promise<T>
```
