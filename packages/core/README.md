# @canvas-js/core

A Canvas app replicates and executes a log of signed actions.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [Contracts](#contracts)
  - [Actions](#actions)
  - [Authenticating with sessions](#authenticating-with-sessions)
  - [Querying the database](#querying-the-database)
  - [Subscribing to live queries](#subscribing-to-live-queries)
- [API](#api)
- [Development](#development)
- [Testing](#testing)
- [API](#api)

## Overview

Canvas apps are built on a programmable multi-writer peer-to-peer CRDT relational database. They're easy to configure and automatically have several desirable properties:

- **Off-chain**. No transaction fees or confirmation wait times.
- **Real-time p2p**. Peers connect and sync directly with each other over libp2p, and use GossipSub topics to broadcast actions.
- **Multi-writer**. Any number of peers can concurrently execute new actions, without waiting for consensus.
- **Eventually consistent**. Actions can freely read and write to a relational database. Every peer's database state will deterministically converge regardless of the order in which the actions are received.
- **Self-authenticating**. Every action is signed by a session key authorized by an end user identity, using e.g. SIWE for Ethereum identities. The entire action log can be verified and replayed by anyone at any time; applications are trustless and portable.
- **Cross-platform**. Canvas apps run in the browser or on NodeJS, persisting data with IndexedDB and SQLite/LMDB, respectively.

## Installation

```
$ npm i @canvas-js/core
```

## Usage

### Contracts

Canvas apps are configured by three values:

1. `topic`: A global string identifier for the application
2. `models`: A relational database schema, expressed in a concise JSON DSL documented in [packages/modeldb/README.md](https://github.com/canvasxyz/canvas/tree/main/packages/modeldb)
3. `actions`: An object of _action handler_ functions that execute each type of action

These values are collectively called a "contract" and can be provided in two ways - either inline as regular JavaScript values, or as ESM exports of a JavaScript _file_ provided as a string.

The simplest way to get started is to import `@canvas-js/core` and call `Canvas.initialize({ ... })` with an inline contract.

```ts
import { Canvas } from "@canvas-js/core"

const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: {
      posts: {
        id: "primary",
        user: "string",
        content: "string",
        updated_at: "integer",
      },
    },
    actions: {
      async createPost(db, { content }, { id, chain, address, timestamp }) {
        const user = [chain, address].join(":")
        await db.posts.set({ id, user, content, updated_at: timestamp })
      },
      async deletePost(db, { postId }, { chain, address }) {
        const post = await db.posts.get(postId)
        if (post === null) {
          return
        }

        const user = [chain, address].join(":")
        if (post.user !== user) {
          throw new Error("not authorized")
        }

        await db.posts.delete(postId)
      },
    },
  },
})

await app.actions.createPost({ content: "hello world!" })
const results = await app.db.query("posts", {})
// [
//   {
//     id: '09p5qn7affkhtbflscr663tet8ddeu41',
//     user: 'eip155:1:0x79c5158f81ebb0c2bcF877E9e1813aed2Eb652B7',
//     content: 'hello world!',
//     updated_at: 1698339861041
//   }
// ]
```

### Actions

Canvas apps consist of an _action log_ and a _model database_. Each action in the log has:

- a `name` (`createPost` or `deletePost` in the example)
- an argument object `args` (`{ content: "hello world!" }`)
- an authenticated user identity `chain` + `address` using the [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) standard format
- a `timestamp` and an optional `blockhash` (timestamps are unverified / purely informative)

```ts
type Action = {
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

Every action is executed by its corresponding action handler in the contract's `actions` object. The action handlers are invoked with a mutable database handle `db`, the action's `args`, and a context object with the rest of the action metadata.

The database can be read and queried at any time, but can only be mutated from inside an action handler executing an action. Actions implement the business logic of your application: every effect must happen through an action, although actions can have many effects and will be applied in a single atomic transaction.

Actions must also handle authorization and access control. In the example's `deletePost` action handler, we have to enforce that users can only delete their own posts, and not arbitrary posts.

```ts
async function deletePost(db, { postId }, { chain, address }) {
  const post = await db.posts.get(postId)
  if (post === null) {
    return
  }

  const user = [chain, address].join(":")
  if (post.user !== user) {
    throw new Error("not authorized")
  }

  await db.posts.delete(postId)
}
```

### Authenticating with sessions

We want end users to authenticate with public-key identities, but it’s not always practical to prompt the user for a wallet signature on every interaction. As a result, Canvas applications are initialized with **session signers**, which define different ways that users can authenticate themselves.

For example, the `SIWESigner` exported by `@canvas-js/chain-ethereum` matches actions with `eip155:*` chains, the EIP-155 identifier for Ethereum.

```ts
import { BrowserProvider } from "ethers"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas } from "@canvas-js/core"

const provider = new BrowserProvider(window.ethereum)
const jsonRpcSigner = await provider.getSigner()

const app = await Canvas.initialize({
  contract: { ... },
  signers: [new SIWESigner({ signer: jsonRpcSigner })],
})

// the user will first be prompted for a SIWE signature
await app.createPost({ content: "can I get an uhhhh yeah??" })

// subsequent actions calls will use the cached session
await app.createPost({ content: "uhhhh yeah!!" })
```

Before a user can interact with a Canvas application, they must first authorize a session. Sessions consist of an ephemeral keypair and a chain-specific payload representing a user's (temporary) authorization of that keypair to sign actions on their behalf. Session signers are responsible for safely managing the ephemeral private keys, and requesting authorization of new sessions from the end user when necessary.

In the example, the `SIWESigner` will do this the first time the user calls an action, and/or whenever the session expires, by requesting a signature from the `signer: ethers.AbstractSigner` it was given. If you initialize `SIWESigner` with a Metamask connection, it will pop up a message asking the user to sign a [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361) message with the ephemeral public key as the resource URI.

You can provide multiple signers to `Canvas.initialize`, and you can control which signer is used to sign actions using either the `chain` or `signer` options of the action method:

```ts
const app = await Canvas.init({
  contract: { ... },
  signers: [
    new SIWESigner({ signer: jsonRpcSigner }),
    new SIWESigner({ signer: Wallet.createRandom() }),
  ],
})

// Use a specific signer
await app.actions.createPost({ content: "foo" }, { signer: app.signers[1] })

// Use first signer matching a certain chain
await app.actions.createPost({ content: "bar" }, { chain: "eip155:1" })

// Defaults to the first signer app.signers[0]
await app.actions.createPost({ content: "baz" })
```

Strictly speaking, you _can_ sign actions using signers that weren't provided at initialization (and thus aren't in the `app.signers` array). The caveat is that you must still have a signer matching the same family of chains in `app.signers`, or else session verification will fail.

### Querying the database

Only actions can write to the database, but it can be queried from the outside at any time.

```ts
const app = await Canvas.initialize({
  contract: {
    topic: "com.example.my-app",
    models: {
      posts: {
        id: "primary",
        user: "string",
        content: "string",
        updated_at: "integer",
      },
    },
    actions: { ... }
  },
})

const { id: idA } = await app.actions.createPost({ content: "foo" }) // 08arkku017tl90n9dptlkkd62vooji11
const { id: idB } = await app.actions.createPost({ content: "bar" }) // 0cfag48t05mags2lhdt9idn3cbpubl1e
const { id: idC } = await app.actions.createPost({ content: "baz" }) // 0j77pkoundspspv1dgkppvceduu8s2t1

await app.db.get("posts", idA)
// {
//   id: '08arkku017tl90n9dptlkkd62vooji11',
//   user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//   content: 'foo',
//   updated_at: 1698344798345
// }

await app.db.query("posts")
// [
//   {
//     id: '08arkku017tl90n9dptlkkd62vooji11',
//     user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//     content: 'foo',
//     updated_at: 1698344798345
//   },
//   {
//     id: '0cfag48t05mags2lhdt9idn3cbpubl1e',
//     user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//     content: 'bar',
//     updated_at: 1698344798363
//   },
//   {
//     id: '0j77pkoundspspv1dgkppvceduu8s2t1',
//     user: 'eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6',
//     content: 'baz',
//     updated_at: 1698344798366
//   }
// ]

await app.db.query("posts", {
  select: { id: true, content: true },
  orderBy: { updated_at: "desc" },
})

// [
//   { id: '0j77pkoundspspv1dgkppvceduu8s2t1', content: 'baz' },
//   { id: '0cfag48t05mags2lhdt9idn3cbpubl1e', content: 'bar' },
//   { id: '08arkku017tl90n9dptlkkd62vooji11', content: 'foo' },
// ]

await app.db.query("posts", {
  select: { id: true, content: true },
  where: { content: { lte: "eee" } },
})

// [
//   { id: '0cfag48t05mags2lhdt9idn3cbpubl1e', content: 'bar' },
//   { id: '0j77pkoundspspv1dgkppvceduu8s2t1', content: 'baz' },
// ]
```

### Subscribing to live queries

You can also subscribe to queries, which is particularly convenient in the browser using the `useLiveQuery` React hook exported from `@canvas-js/hooks`.

```tsx
import { useCanvas, useLiveQuery } from "@canvas-js/hooks"

const contract = {
  topic: "com.example.my-app",
  models: { ... },
  actions: {
    async createPost(db, args, {}) { ... }
    async deletePost(db, args, {}) { ... }
  }
}

const MyComponent = (props: {}) => {
  const { app, error } = useCanvas({ contract })

  const posts = useLiveQuery(app, "posts", { limit: 10, orderBy: { updated_at: "desc" } })
  return (
    <div>
      {posts.map((post) => <div id={post.id}>{post.content}</div>)}
    </div>
  )
}
```

## API

### Contract types

```ts
import type { ModelsInit, ModelValue } from "@canvas-js/modeldb"

export type InlineContract = {
  topic: string
  models: ModelsInit
  actions: Record<string, ActionImplementationFunction | ActionImplementationObject>
}

export type ActionImplementationObject = {
  argsType?: { schema: string; name: string }
  apply: ActionImplementationFunction
}

export type ActionImplementationFunction = (
  db: Record<string, ModelAPI>,
  args: Args,
  context: ActionContext
) => Awaitable<Result>

export type ModelAPI = {
  get: (key: string) => Promise<ModelValue | null>
  set: (value: ModelValue) => Promise<void>
  delete: (key: string) => Promise<void>
}

export type ActionContext = {
  id: string
  chain: string
  address: string
  blockhash: string | null
  timestamp: number
}
```

### `Message`, `Action` and `Session` types

```ts
export type Message<Payload = unknown> = {
  topic: string
  clock: number
  parents: string[]
  payload: Payload
}

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

export type Session = {
  type: "session"

  /** CAIP-2 prefix, e.g. "eip155:1" for mainnet Ethereum */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  /** ephemeral session key used to sign subsequent actions */
  publicKeyType: "ed25519" | "secp256k1"
  publicKey: Uint8Array

  /** chain-specific session payload, e.g. a SIWE message & signature */
  data: any

  timestamp: number
  blockhash: string | null
  duration: number | null
}
```

### `Canvas` class

```ts
import { SessionSigner } from "@canvas-js/interfaces"

export interface CanvasConfig {
  contract: string | InlineContract

  /**
   * Defaults to the topic.
   * - NodeJS: data directory path
   * - browser: IndexedDB database namespace
   */
  location?: string | null

  signers?: SessionSigner[]
  replay?: boolean
  runtimeMemoryLimit?: number

  // libp2p options
  offline?: boolean
  start?: boolean
  listen?: string[]
  announce?: string[]
  bootstrapList?: string[]
  minConnections?: number
  maxConnections?: number

  /** set to `false` to disable history indexing and db.get(..) within actions */
  indexHistory?: boolean
}

export interface CanvasEvents {
  close: Event
  connect: CustomEvent<{ peer: PeerId }>
  disconnect: CustomEvent<{ peer: PeerId }>

  message: CustomEvent<{ id: string; signature: Signature; message: Message<Action | Session> }>
  commit: CustomEvent<{ root: Node }>
  sync: CustomEvent<{ peer: string | null }>
}

export declare class Canvas extends EventEmitter<CanvasEvents> {
  public static initialize(config: CanvasConfig): Promise<Canvas>

  public readonly topic: string
  public readonly signers: SessionSigner[]
  public readonly peerId: PeerId
  public readonly libp2p: Libp2p<ServiceMap> | null
  public readonly db: AbstractModelDB

  public readonly actions: Record<
    string,
    (
      args: any,
      options: { chain?: string; signer?: SessionSigner }
    ) => Promise<{ id: string; recipients: Promise<PeerId[]> }>
  >

  public close(): Promise<void>
  public start(): Promise<void>
  public stop(): Promise<void>

  public getMessage(id: string): Promise<[signature: Signature, message: Message<Action | Session>] | [null, null]>
  public getMessageStream(
    lowerBound?: { id: string; inclusive: boolean } | null,
    upperBound?: { id: string; inclusive: boolean } | null,
    options?: { reverse?: boolean }
  ): AsyncIterable<[id: string, signature: Signature, message: Message<Action | Session>]>
}
```

## Development

The package should be built with typescript in composite build mode from the repo root, not from the package directory here.

## Testing

```
npm run test
```
