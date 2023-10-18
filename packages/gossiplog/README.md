# @canvas-js/gossiplog

GossipLog is a decentralized, authenticated, multi-writer log designed to serve as a **general-purpose foundation for peer-to-peer applications**. It can be used as a simple replicated data store, the transaction log of a database, or the execution log of a full-fledged VM.

GossipLog can run in the browser using IndexedDB for persistence, on NodeJS using LMDB, or entirely in-memory.

## Table of contents

- [Overview](#overview)
- [Design](#design)
  - [Messages](#messages)
  - [Message IDs](#message-ids)
  - [Authentication](#authentication)
- [Usage](#usage)
  - [Initialization](#initialization)
  - [Appending new messagse](#appending-new-messages)
  - [Inserting existing messages](#inserting-existing-messages)
  - [Syncing with other peers](#syncing-with-other-peers)
  - [Indexing ancestors](#indexing-ancestors)
- [API](#api)

## Overview

People use apps, apps use databases, and databases use logs. Rather than creating new peer-to-peer protocols from scratch at the application layer, we can consolidate the work by making a generic log that has networking and syncing built-in. This can be used by developers to make automatically-decentralized apps without writing a single line of networking code.

Logs are identified by a global `topic` string. Any number of peers can replicate a log, and any peer can append to their local replica at any time (unlike Hypercore, for example). Peers broadcast messages via pubsub using libp2p, and also sync directly with each other using special merklized indices called [Prolly trees](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit).

GossipLog makes this all possible at the expense of two major tradeoffs:

1. Logs are only **partially ordered**. The messages in the log are structured in a causal dependency graph; GossipLog guarantees that each message will only be delivered after all of its transitive dependencies are delivered, but doesn't guarantee delivery order within that.
2. Logs must be deterministically **self-authenticating**.

The implications of 1) are that GossipLog is best for applications where eventual consistency is acceptable, and where message delivery is commutative in effect. GossipLog messages carry a built-in logical clock that can be easily used to create last-write-wins registers and other CRDT primitives.

The implications of 2) are that the access control logic - who can append what to the log - must be expressed as a pure function of the payload, message signature / public key, and any state accumulated from the message's transitive dependencies. The simplest case would be a whitelist of known "owner" public keys, although bridging these to on-chain identities like DAO memberships via session keys is also possible. See the section on [Authentication](#authentication) for more detail.

## Design

### Messages

Log contain _messages_. Messages carry abitrary application-defined payloads. GossipLog uses the [IPLD data model](https://ipld.io/docs/data-model/), a superset of JSON that includes raw bytes and [CIDs](https://github.com/multiformats/cid) as primitive types.

```ts
type Message<Payload = unknown> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

Similar to Git commits, every message has zero or more parent messages, giving the log a graph structure.

![Component 1.png](Component%201.png)

We can derive a logical clock value for each message from its depth in the graph, or, equivalently, by incrementing the maximum clock value of its direct parents. When a peer appends a new payload value to its local replica, it creates a message with all of its current "heads" (messages without children) as parents, and incrementing the clock.

### Message IDs

Message IDs begin with the message clock, encoded as an [unsigned varint](https://github.com/multiformats/unsigned-varint), followed by the sha2-256 hash of the serialized signed message, and truncated to 20 bytes total. These are encoded using the [`base32hex`](https://www.rfc-editor.org/rfc/rfc4648#section-7) alphabet to get 32-character string IDs, like `054ki1oubq8airsc9d8sbg0t7itqbdlf`.

These string IDs can be sorted directly using the normal JavaScript string comparison to get a total order over messages that respects both logical clock order and transitive dependency order. This means that implementing a last-write-wins register for message effects is as simple as caching and comparing message IDs as versions.

### Authentication

By default, GossipLog requires every message to be signed with a [`@canvas-js/signed-cid`](https://github.com/canvasxyz/canvas/tree/main/packages/signed-cid) signature.

```ts
// @canvas-js/signed-cid
import type { CID } from "multiformats/cid"

type Signature = {
  type: "ed25519" | "secp256k1"
  publicKey: Uint8Array
  signature: Uint8Array
  cid: CID
}
```

The `cid` in a message signature is the CID of the `Message` object using the `dag-cbor` codec and `sha2-256` multihash digest. The `signature` signs the raw bytes of the CID (`cid.bytes`); the `Signature` object carries all the relevant contextual data including the signature type and the public key.

Most GossipLog methods pass signatures alongside messages using a `[signature: Signature | null, message: Message<Payload>]` tuple type.

Expressing an application's access control logic purely in terms of public keys and signatures can be challenging. The simplest case is one where a only a known fixed set of public keys are allowed to write to the log; at the very least, this generalizes all of Hypercore's use cases. Another simple case is for open-ended applications where end users have keypairs, and the application can access the private key and programmatically sign messages directly.

A more complex case is one where the application doesn't have programmatic access to private keys, such as web3 apps where wallets require user confirmations for every signature (and only sign messages in particular formats). One approach here is to use sessions, a designated type of message payload that registers a temporary public key and carries an additional signature authorizing the public key to take actions on behalf of some other identity, like an on-chain address. This is implemented for Canvas apps for a variety of chains via the session signer interface.

## Usage

### Initialization

The browser/IndexedDB, NodeJS/LMDB, and in-memory GossipLog implementations are exported from separate subpaths:

```ts
import { GossipLog } from "@canvas-js/gossiplog/browser"

// opens an IndexedDB database
const gossipLog = await GossipLog.open("my-database-name", { ...init })
```

```ts
import { GossipLog } from "@canvas-js/gossiplog/node"

// opens an LMDB environment
const gossipLog = await GossipLog.open("path/to/data/directory", { ...init })
```

```ts
import { GossipLog } from "@canvas-js/gossiplog/memory"

const gossipLog = await GossipLog.open({ ...init })
```

All three are configured with the same `init` object:

```ts
interface GossipLogInit<Payload = unknown, Result = void> {
  topic: string
  apply: (id: string, signature: Signature | null, message: Message<Payload>) => Result | Promise<Result>
  validate: (payload: unknown) => payload is Payload

  signatures?: boolean
  sequencing?: boolean
  replay?: boolean
}
```

The `topic` is the global topic string identifying the log - we recommend using NSIDs like `com.example.app.mylog`.

Logs are generic in two parameters, `Payload` and `Result`. You must provide a `validate` method as a TypeScript type predicate that synchronously validates an `unknown` value as a `Payload` (it is only guaranteed to be an IPLD data model value). Only use `validate` for type/schema validation, not for authentication or authorization.

The `apply` function is the main attraction. It is invoked once\* for every message, both for messages appended locally and for messages received from other peers. It is called with the message ID, the signature, and the message itself. If `apply` throws an error, then the message will be discarded and not persisted.

`apply` has three primary responsibilities: authorizing public keys, validating payload semantics, and performing side effects.

#### Authorization

If signatures are enabled, the message signature will be verified **before** `apply` is called. This means that, within `apply`, `signature.publicKey` is known to have signed the `message`, but it is still `apply`'s responsibility to verify that the given public key is authorized to append the given payload to the log. If signatures are disabled, then the `signature` argument is always `null`.

#### Semantic validation

Payloads may require additional application-specific validation beyond what is checked by the `validate` type predicate, like bounds/range checking, or anything requiring async calls.

#### Side effects

`apply`'s basic role is to "process" messages. If the log is only used as a data store, and the application just needs to look up payloads by message ID, nothing more needs to happen. But typically, applications will index message payloads in another local database and/or execute some local side effects.

#### Optional configuration values

- `signatures` (default `true`): require message signatures; if set to `false` all methods will expect `signature` values to be `null`
- `sequencing` (default `true`): enable the causal graph structure; if set to `false`, all messages will have `clock: 0` and `parents: []`
- `replay` (default `false`): upon initializing, iterate over all existing messages and invoke the `apply` function for them all
- `indexAncestors` (default `false`): enable [ancestor indexing](#indexing-ancestors)

\* `apply` is invoked with **at least once** semantics: in rare cases where transactions to the underlying storage layer fail to commit, `apply` might be invoked more than once with the same message. Messages will **never** be persisted without a successful call to `apply`.

### Appending new messages

Once you have a `GossipLog` instance, you can append a new payload to the log with `gossipLog.append(payload, { signer })`. The `signer` option must be provided unless signatures are disabled, and it must be an instance of the `MessageSigner<Payload>` interface:

```ts
interface MessageSigner<Payload = unknown> {
  sign: (message: Message<Payload>) => Awaitable<Signature | null>
}
```

Creating a `MessageSigner` is as simple as currying the `type` and `privateKey` arguments out of the `createSignature` method exported from `@canvas-js/signed-cid`:

```ts
import { createSignature } from "@canvas-js/signed-cid"

function createSigner<Payload>(type: "ed25519" | "secp256k1", privateKey: Uint8Array): MessageSigner<Payload> {
  return {
    sign: (message) => createSignature(type, privateKey, message),
  }
}
```

Calling `append` executes the following steps:

1. Open an exclusive read-write transaction in the underlying database.
2. Look up the current `parents: string[]` and `clock: number` to create the message object `{ topic, clock, parents, payload }`.
3. Sign the message using the provided `signer` to get a `signature: Signature | null`.
4. Serialize the signed message and compute its message ID.
5. Call `apply(id, signature, message)` and save its return value as `result`. If `apply` throws, abort the transaction and re-throw the error.
6. Write the serialized signed message to the database, using the message ID as the key.
   - If there are messages in the mempool waiting on this message, apply them and save them to the database as well
7. Commit the transaction.
8. Return `{ id, signature, message, result }`.

In a peer-to-peer context, the `signature` and `message` can be sent to other peers, who can insert them directly using `gossipLog.insert`.

### Inserting existing messages

Given an existing `signature: Signature | null` and `message: Message<Payload>`, ie a signed message received from another peer, we can insert them locally using `gossipLog.insert(signature, message)`. This executes the following steps:

1. Open an exclusive read-write transaction in the underlying database.
2. Serialize the signed message and compute its message ID.
3. Verify that all of the message's parents already exist in the database.
   - If not, add the signed message to the mempool, abort the transaction, and return `{ id }`.
4. Call `apply(id, signature, message)` and save its return value as `result`. If `apply` throws, abort the transaction and re-throw the error.
5. Write the serialized signed message to the database, using the message ID as the key.
   - If there are messages in the mempool waiting on this message, apply them and save them to the database as well.
6. Commit the transaction.
7. Return `{ id }`.

### Syncing with other peers

TODO

### Indexing ancestors

If `init.indexAncestors` is `true`, GossipLog will maintain an additional "ancestor index" that allows users to look up transitive ancestors of any message at an arbitrary clock in the message's past.

In the example below, `await gossiplog.getAncestors(l, 6)` would return `[h, i]`, while `await gossiplog.getAncestors(k, 6)` would only return `[i]`. The dotted arrows depict the exponential decay links in the ancestor index.

```
   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                                                                                              │
   │                                                   │                         │                         │
   ▼                                                   ▼                         ▼            ▼
                                                                                                           │
                                          ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┬ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                                                                                 │                         │
                                          │                         │                         │
                                          ▼                         ▼            ▼                         │
                                                                                              │
                                       ┌─────┐      ┌─────┐      ┌─────┐                                   │
                                   ┌───│  d  │◀─────│  f  │◀─────│  h  │◀──────────────┐      │
                                   │   └─────┘      └─────┘      └─────┘               │                   │
┌─────┐      ┌─────┐      ┌─────┐  │                                                   │      │         ┌─────┐
│  a  │◀─────│  b  │◀─────│  c  │◀─┤                                                   └────────────┬───│  l  │
└─────┘      └─────┘      └─────┘  │                                                          │     │   └─────┘
                                   │   ┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐  │
                                   └───│  e  │◀─────│  g  │◀─────│  i  │◀─────│  j  │◀─────│  k  │◀─┘
                                       └─────┘      └─────┘      └─────┘      └─────┘      └─────┘


   1            2            3            4            5            6            7            8            9

                                                       │            │            │

   ▲                         ▲            ▲            │            │            │
   │                         │
                                          │            │            │            │
   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┴ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                                                                    │            │

                ▲                         ▲            ▲            │            │
                │                         │
                                                       │            │            │
                └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┴ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                                                                                 │

                             ▲                         ▲            ▲            │
                             │                         │
                                                                    │            │
                             └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┴ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

## API

```ts
interface GossipLogInit<Payload = unknown, Result = void> {
  topic: string
  apply: (id: string, signature: Signature | null, message: Message<Payload>) => Awaitable<Result>
  validate: (payload: unknown) => payload is Payload
  replay?: boolean
  signatures?: boolean
  sequencing?: boolean
  indexAncestors?: boolean
}

interface MessageSigner<Payload = unknown> {
  sign: (message: Message<Payload>) => Awaitable<Signature | null>
}

type GossipLogEvents<Payload, Result> = {
  message: CustomEvent<{ id: string; signature: Signature | null; message: Message<Payload>; result: Result }>
  commit: CustomEvent<{ topic: string; root: Node }>
  sync: CustomEvent<{ topic: string; peerId: PeerId }>
}

interface AbstractGossipLog<Payload = unknown, Result = unknown>
  extends EventEmitter<GossipLogEvents<Payload, Result>> {
  readonly topic: string

  public close(): Promise<void>

  public append(
    payload: Payload,
    options?: { signer?: MessageSigner<Payload> }
  ): Promise<{ id: string; signature: Signature | null; message: Message<Payload>; result: Result }>

  public insert(signature: Signature | null, message: Message<Payload>): Promise<{ id: string }>

  public sync(sourcePeerId: PeerId, source: Source): Promise<{ root: Node }>

  public serve(targetPeerId: PeerId, callback: (source: Source) => Promise<void>): Promise<void>

  public get(id: string): Promise<[signature: Signature | null, message: Message<Payload> | null]>

  public iterate(
    lowerBound?: { id: string; inclusive: boolean } | null,
    upperBound?: { id: string; inclusive: boolean } | null,
    options?: { reverse?: boolean }
  ): AsyncIterable<[id: string, signature: Signature | null, message: Message<Payload>]>

  public getClock(): Promise<[clock: number, parents: string[]]>

  public getAncestors(id: string, ancestorClock: number): Promise<string[]>
}
```
