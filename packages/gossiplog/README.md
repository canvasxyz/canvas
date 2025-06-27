# @canvas-js/gossiplog

GossipLog is a decentralized, authenticated, multi-writer log designed to serve as a **general-purpose foundation for peer-to-peer applications**. It can be used as a simple replicated data store, the transaction log of a database, or the execution log of a full-fledged VM.

GossipLog can run in the browser using IndexedDB for persistence, on NodeJS using SQLite + LMDB, or entirely in-memory.

## Table of contents

- [Overview](#overview)
- [Design](#design)
  - [Messages](#messages)
  - [Message signatures](#message-signatures)
  - [Message signers](#message-signers)
  - [Message IDs](#message-ids)
- [Usage](#usage)
  - [Initialization](#initialization)
  - [Appending new messagse](#appending-new-messages)
  - [Inserting existing messages](#inserting-existing-messages)
  - [Syncing with other peers](#syncing-with-other-peers)
  - [Advanced authentication use cases](#advanced-authentication-use-cases)
- [API](#api)

## Overview

People use apps, apps use databases, and databases use logs. Rather than creating new peer-to-peer protocols from scratch at the application layer, we can consolidate the work by making a generic log that has networking and syncing built-in. This can be used by developers to make automatically-decentralized apps without writing a single line of networking code.

Logs are identified by a global `topic` string. Any number of peers can replicate a log, and any peer can append to their local replica at any time. Peers broadcast messages via pubsub using libp2p, and sync directly with each other using special merklized indices called [Prolly trees](https://joelgustafson.com/posts/2023-05-04/merklizing-the-key-value-store-for-fun-and-profit).

GossipLog makes this all possible at the expense of two major tradeoffs:

<dl>
  <dt>Logs are only <strong>partially ordered</strong>.</dt>
  <dd>
    This means that GossipLog is best for applications where eventual consistency is acceptable, and where message delivery is commutative (and idempotent) in effect. The entries of the log are organized in a causal dependency graph; GossipLog guarantees that each message will only be applied after all of its transitive dependencies are applied, but doesn't guarantee order within that.
  </dd>
  <dt>Logs must be deterministically <strong>self-authenticating</strong>.</dt>
  <dd>
    This means that the access control logic - who can append what to the log - must be expressed as a pure function of the payload, message signature + public key, and any state accumulated from the message's transitive dependencies.
  </dd>
</dl>

GossipLog tries to make it as simple as possible to work within these constraints. All messages carry a built-in logical clock that can be used to easily create last-write-wins registers and other CRDT primitives. Similarly, the simplest case form of ACL is a whitelist of fixex "owner" public keys, but bridging these to on-chain identities like DAO memberships via session keys is also possible. See the notes on [advanced authentication use cases](#advanced-authentication-use-cases) for more detail.

## Design

### Messages

Log contain _messages_. Messages carry abitrary application-defined payloads. GossipLog uses the [IPLD data model](https://ipld.io/docs/data-model/), a superset of JSON that includes raw bytes and [CIDs](https://github.com/multiformats/cid) as primitive types.

```ts
type Message<Payload> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}
```

Similar to Git commits, every message has zero or more parent messages, giving the log a graph structure.

<img width="938" alt="Component 1" src="https://github.com/user-attachments/assets/12a9b272-5ed1-4d8b-801c-6021cdc771da">

We derive a logical clock value for each message from its depth in the graph, or, equivalently, by incrementing the maximum clock value of its direct parents. When a peer appends a new payload value to its local replica, it creates a message with all of its current "heads" (messages without children) as parents, and incrementing the clock.

### Message signatures

GossipLog requires every message to be signed with a `Signature` object.

```ts
type Signature = {
  codec: string /** "dag-cbor" | "dag-json" */
  publicKey: string /** did:key URI */
  signature: Uint8Array
}
```

The `codec` identifies how the message was serialized to bytes for signing. `dag-cbor` and `dag-json` are the two codecs supported by default. Only Ed25519 [did:key](https://w3c-ccg.github.io/did-method-key/) URIs are supported by default. These can be extended by providing a custom signer implementation and providing a custom `verifySignature` method to the init object.

### Message signers

Although it's possible to create and sign messages manually, the simplest way to use GossipLog is to use the `ed25519` signature scheme exported from `@canvas-js/signatures`.

```ts
import { ed25519 } from "@canvas-js/signatures"

const signer = ed25519.create()
// or ed25519.create({ type: "ed25519", privateKey: new Uint8Array([ ... ]) })
```

Once you have a signer, you can add it to `GossipLogInit` to use it by default for all appends, or pass a specific signer into each call to `append` individually.

```ts
const signerA = ed25519.create()
const signerB = ed25519.create()

const log = await GossipLog.init({ ...init, signer: signerA })

// use signerA to sign the message
await log.append({ ...payload })

// use signerB to sign the message
await log.append({ ...payload }, { signer: signerB })
```

### Message IDs

Message IDs begin with the message clock, followed by the sha2-256 hash of the serialized signed message, and truncated to 20 bytes total. These are encoded using the [`base32hex`](https://www.rfc-editor.org/rfc/rfc4648#section-7) alphabet to get 32-character string IDs, like `9j9dfp0rr52t9jnvj1imqj2ivfh9v3r3`.

<img width="517" alt="Component 2" src="https://github.com/user-attachments/assets/2a795584-60ec-4d1e-a98b-ef3d26bf6c3f">

The message clock is encoded using a special variable-length format designed to preseve sorting order (ie message IDs sort lexicographically according to their clock values).

Clock values less than 128 are encoded as-is in a single byte.

For clock values larger than 128, the variable-length begins with a unary representation (in bits) of the number of additional _bytes_ (not bits) used to represent the clock value, followed by a `0` separator bit, followed by the binary clock value padded on the left.

```
| input   | input (binary)             | output (binary)            | output (hex)  |
| ------- | -------------------------- | -------------------------- | ------------- |
| 0       | 00000000                   | 00000000                   | 0x00          |
| 1       | 00000001                   | 00000001                   | 0x01          |
| 2       | 00000002                   | 00000010                   | 0x02          |
| 127     | 01111111                   | 01111111                   | 0x7f          |
| 128     | 10000000                   | 10000000 10000000          | 0x8080        |
| 129     | 10000001                   | 10000000 10000001          | 0x8081        |
| 255     | 11111111                   | 10000000 11111111          | 0x80ff        |
| 256     | 00000001 00000000          | 10000001 00000000          | 0x8100        |
| 1234    | 00000100 11010010          | 10000100 11010010          | 0x84d2        |
| 16383   | 00111111 11111111          | 10111111 11111111          | 0xbfff        |
| 16384   | 01000000 00000000          | 11000000 01000000 00000000 | 0xc04000      |
| 87381   | 00000001 01010101 01010101 | 11000001 01010101 01010101 | 0xc15555      |
| 1398101 | 00010101 01010101 01010101 | 11010101 01010101 01010101 | 0xd55555      |
```

For example, consider the clock value 87381. The encoded output begins with `110` to indicate that two additional bytes are used to encode the clock. Then, the remaining bits `00001 01010101 01010101` are decoded as the clock value.

The rationale here is that prefixing message IDs with a _lexicographically sortable_ logical clock has many useful consquences. Regular Protobuf-style unsigned varints don't sort the same as their decoded values.

These string message IDs can be sorted directly using the normal JavaScript string comparison to get a total order over messages that respects both logical clock order and transitive dependency order. For example, implementing a last-write-wins register for message effects is as simple as caching and comparing message ID strings.

## Usage

### Initialization

The browser/IndexedDB and NodeJS/SQLite GossipLog implementations are exported from separate subpaths

#### IndexedDB

```ts
import { GossipLog } from "@canvas-js/gossiplog/idb"

// opens an IndexedDB database named `my-app-log`
const gossipLog = await GossipLog.open({ ...init, name: "my-app-log" })
```

#### SQLite

```ts
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

{
  // opens a SQLite database at path/to/data/directory/db.sqlite,
  // and an LMDB merkle index at path/to/data/directory/message-index
  const gossipLog = new GossipLog({ ...init, directory: "path/to/data/directory" })
}

{
  // opens an in-memory SQLite database and an in-memory merkle index
  const gossipLog = new GossipLog({ ...init, directory: null })
}
```

#### Configuration

All backends are configured with the same `init` object:

```ts
import type { Signature, Signer, Message } from "@canvas-js/interfaces"

// This is an internal class used to cache encoded and decoded formats
// of signed messages together. The user's `apply` function is called
// with instances of `SignedMessage`.
declare class SignedMessage<Payload> {
  /** use gossipLog.encode() and gossipLog.decode() to get SignedMessage instances */
  private constructor() {}

  readonly id: string
  readonly signature: Signature
  readonly message: Message<Payload>

  /** serialized bytes for storage/transport */
  readonly key: Uint8Array
  readonly value: Uint8Array
}

type GossipLogConsumer<Payload> = (signedMessage: SignedMessage<Payload>) => Awaitable<void>

interface GossipLogInit<Payload> {
  topic: string
  apply: GossipLogConsumer<Payload>
  signer?: Signer<Payload> // a random Ed25519 private key will be generated if not provided

  validatePayload?: (payload: unknown) => payload is Payload
  verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>
}
```

The `topic` is the global topic string identifying the log - we recommend using DNS names like `my-app.example.com`. Topics must match `/^[a-zA-Z0-9:\.\-]+$/`.

Logs are generic in a `Payload` parameter. You can provide a `validatePayload` method as a TypeScript type predicate to synchronously validate an `unknown` value as a `Payload` (it is only guaranteed to be an IPLD data model value). Only use `validatePayload` for type/schema validation, not for authn/authz.

The `apply` function is the main event consumer. It is invoked once for every message, both for messages appended locally and for messages received from other peers. It is called with the message ID, the signature, and the message itself. If `apply` throws an error, then the message will be discarded and not persisted.

`apply` has three primary responsibilities: authorizing public keys, validating payload semantics, and performing side effects.

#### Authorization

The message signature will be verified **before** `apply` is called. This means that, within `apply`, `signature.publicKey` is known to have signed the `message`, but it is still `apply`'s responsibility to verify that the given public key is authorized to append the given payload to the log.

#### Semantic validation

Payloads may require additional application-specific validation beyond what is checked by the `validatePayload` type predicate, like bounds/range checking, or anything requiring async calls.

#### Side effects

`apply`'s basic role is to "process" messages. If the log is only used as a data store, and the application just needs to look up payloads by message ID, nothing more needs to happen. But typically, applications will index message payloads in another local database and/or execute some local side effects.

### Appending new messages

Once you have a `GossipLog` instance, you can append a new payload to the log with `gossipLog.append(payload)`.

If the log is connected to peers (via libp2p or directly via WebSocket), the `signature` and `message` will be sent to those peers, who will automatically validate and insert them using `gossipLog.insert`.

### Inserting existing messages

If for some reason you have an existing `signature: Signature` and `message: Message<Payload>`, such as a signed message received over the network from another peer or constructed manually without using `.append`, you can still manually insert it into the log by using `.encode` and then calling `.insert`.

```ts
const signedMessage = gossipLog.encode(signature, message)
await gossipLog.insert(signedMessage)
```

Typically, you should never need to call `.insert` yourself unless you are doing something special, like delivering messages using your own network transport.

### Syncing with other peers

GossipLog supports two network topologies: client/server and peer-to-peer.

#### Client/server

Client/server means one server starts a HTTP server, and accepts WebSocket connections on a dedicated port. Clients (which can run in the browser or NodeJS) connect to the server via `ws://` URL.

```ts
// Server
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

const log = new GossipLog({ ... })
await log.listen(8080)
```

```ts
// Client
import { GossipLog } from "@canvas-js/gossiplog/idb"

const log = await GossipLog.open({ ... })
await log.connect("ws://localhost:8080")
```

#### Peer-to-peer

The peer-to-peer topology uses libp2p, and can only run in NodeJS. Peers can import and start a `NetworkPeer`, passing in one or more WebSocket [multiaddr](https://github.com/multiformats/multiaddr) addresses for listening and announcing. For example, to advertise on DNS name `my.app.com` while binding to the local port 80, a peer would use:

```ts
import { GossipLog } from "@canvas-js/gossiplog/sqlite"

const log = new GossipLog({ ... })
const libp2p = await log.startLibp2p({
  listen: ["/ip4/127.0.0.1/tcp/80/ws"],
  announce: ["/dns4/my.app.com/tcp/443/wss"], // this is required if you want to be dialable!
})

// the `libp2p` peer will automatically connect and sync with other
// GossipLog instances on the same topic...
```

By default, the libp2p node is configured to connect to the default Canvas bootstrap servers, and use the libp2p [rendezvous protocol](https://github.com/libp2p/specs/tree/master/rendezvous) to find other peers on the same topic.

### Advanced authentication use cases

Expressing an application's access control logic purely in terms of public keys and signatures can be challenging. The simplest case is one where a only a known fixed set of public keys are allowed to write to the log. Another simple case is for open-ended applications where end users have keypairs, and the application can access the private key and programmatically sign messages directly.

A more complex case is one where the application doesn't have programmatic access to a private key, such as web3 apps where wallets require user confirmations for every signature (and only sign messages in particular formats). One approach here is to use [sessions](https://docs.canvas.xyz/8-advanced.html), a designated type of message payload that registers a temporary public key and carries an additional signature authorizing the public key to take actions on behalf of some other identity, like an on-chain address. This is implemented for Canvas apps for a variety of chains via the [session signer interface](https://docs.canvas.xyz/8-advanced.html#creating-your-own-session-signer).

## API

Topics must match `/^[a-zA-Z0-9\.\-]+$/`.

```ts
import type { TypedEventEmitter, Libp2p, PrivateKey } from "@libp2p/interface"
import type { Signature, Signer, Message, Awaitable } from "@canvas-js/interfaces"

export class SignedMessage<Payload> {
  /** use gossipLog.encode() and gossipLog.decode() to get SignedMessage instances */
  private constructor() {}

  readonly id: string
  readonly signature: Signature
  readonly message: Message<Payload>

  /** serialized bytes for storage/transport */
  readonly key: Uint8Array
  readonly value: Uint8Array
}

export type GossipLogEvents<Payload = unknown> = {
  message: CustomEvent<SignedMessage<Payload>>
  commit: CustomEvent<{ root: Node; heads: string[] }>
  sync: CustomEvent<{ duration: number; messageCount: number; peer?: string }>
  connect: CustomEvent<{ peer: string }>
  disconnect: CustomEvent<{ peer: string }>
}

export type GossipLogConsumer<Payload = unknown> = (signedMessage: SignedMessage<Payload>) => Awaitable<void>

export type GossipLogInit<Payload = unknown> = {
  topic: string
  apply: GossipLogConsumer<Payload>
  signer?: Signer<Payload>

  /** validate that the IPLD `payload` is a `Payload` type */
  validatePayload?: (payload: unknown) => payload is Payload
  verifySignature?: (signature: Signature, message: Message<Payload>) => Awaitable<void>

  /** add extra tables to the local database for private use */
  schema?: ModelSchema
}

export interface NetworkConfig {
  start?: boolean
  privateKey?: PrivateKey

  /** array of local WebSocket multiaddrs, e.g. "/ip4/127.0.0.1/tcp/3000/ws" */
  listen?: string[]

  /** array of public WebSocket multiaddrs, e.g. "/dns4/myapp.com/tcp/443/wss" */
  announce?: string[]

  bootstrapList?: string[]
  maxConnections?: number
}

export interface GossipLog<Payload = unknown> extends TypedEventEmitter<GossipLogEvents<Payload>> {
  readonly topic: string

  public close(): Promise<void>

  /**
   * Sign and append a new *unsigned* message to the end of the log.
   * The current concurrent heads of the local log are used as parents.
   */
  public append<T extends Payload>(payload: T, options?: { signer?: Signer<Payload> }): Promise<SignedMessage<T>>

  /**
   * Insert an existing signed message into the log (ie received via HTTP API).
   * If any of the parents are not present, throw an error.
   */
  public insert(signedMessage: SignedMessage<Payload>): Promise<void>

  public has(id: string): Promise<boolean>
  public get(id: string): Promise<SignedMessage<Payload> | null>
  public iterate(range?: {
    lt?: string
    lte?: string
    gt?: string
    gte?: string
    reverse?: boolean
    limit?: number
  }): AsyncIterable<SignedMessage<Payload>>

  public replay(): Promise<void>
  public getClock(): Promise<[clock: number, parents: string[]]>

  /** connect directly to a server ws:// URL */
  public connect(url: string, options: { signal?: AbortSignal } = {}): Promise<void>

  /** start a WebSocket server */
  public listen(port: number, options: { signal?: AbortSignal } = {}): Promise<void>

  /** start a Libp2p peer */
  public startLibp2p(config: NetworkConfig): Promise<Libp2p>

  public encode(signature: Signature, message: Message<T>): SignedMessage<Payload>
  public decode(value: Uint8Array): SignedMessage<Payload>
}
```
