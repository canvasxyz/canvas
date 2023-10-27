# @canvas-js/interfaces

This package exports TypeScript types for Canvas messages and other interfaces.

## Table of Contents

- [Interfaces](#interfaces)
  - [`Signature`](#signature)
  - [`Message`](#message)
  - [`Action`](#action)
  - [`Session`](#session)
  - [`MessageSigner`](#messagesigner)
  - [`SessionSigner`](#sessionsigner)
  - [`Awaitable`](#awaitable)

## Interfaces

### `Signature`

```ts
import type { CID } from "multiformats"

export type SignatureType = "ed25519" | "secp256k1"

export type Signature = {
  type: SignatureType
  publicKey: Uint8Array
  signature: Uint8Array
  cid: CID
}
```

### `Message`

```ts
export type Message<Payload = unknown> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

### `Action`

```ts
export type Action = {
  type: "action"

  /** CAIP-2 prefix, e.g. "eip155:1" */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  name: string
  args: any

  timestamp: number
  blockhash: string | null
}
```

### `Session`

```ts
import type { SignatureType } from "./Signature.js"

export type Session<Data = any> = {
  type: "session"

  /** CAIP-2 prefix, e.g. "eip155:1" for mainnet Ethereum */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  /** ephemeral session key used to sign subsequent actions */
  publicKeyType: SignatureType
  publicKey: Uint8Array

  /** chain-specific session payload, e.g. a SIWE message & signature */
  data: Data

  timestamp: number
  blockhash: string | null
  duration: number | null
}
```

### `MessageSigner`

```ts
export interface MessageSigner<Payload = unknown> {
  sign: (message: Message<Payload>) => Signature
}
```

### `SessionSigner`

```ts
import type { MessageSigner } from "./MessageSigner.js"
import type { Session } from "./Session.js"
import type { Action } from "./Action.js"
import type { Awaitable } from "./Awaitable.js"

export interface SessionSigner extends MessageSigner<Action | Session> {
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

### `Awaitable`

```ts
export type Awaitable<T> = T | Promise<T>
```
