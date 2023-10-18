# @canvas-js/core

A `Core` verifies, executes, and applies the effects of signed messages.

> ⚠️ The simplest way to run a Canvas application is to use the [CLI](https://github.com/canvasxyz/canvas/tree/main/packages/cli) or Canvas Hub (coming soon). Only use `@canvas-js/core` directly if you're embedding a Canvas app in a browser context or other JavaScript system.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Authentication](#authentication)
  - [Configuration options](#configuration-options)
  - [Applying messages](#applying-messages)
  - [Evaluating routes](#evaluating-routes)
  - [Get application metadata](#get-application-metadata)
- [Development](#development)
- [Testing](#testing)
- [API](#api)

## Installation

```
$ npm i @canvas-js/core
```

## Usage

To initialize an app, import `@canvas-js/core` and call `Core.initialize({ ... })` with the contract.

```ts
import { Core } from "@canvas-js/core"

const contract = `
// A sample Canvas application
export const models = {
  posts: {
    id: "primary",
    updated_at: "datetime",
    content: "string",
  }
}

export const actions = {
  createPost(db, { content }, { id, chain, address, timestamp }) {
    const postId = [chain, address, id].join(":")
    db.posts.set({ id: postId, content, updated_at: timestamp })
  },
  deletePost(db, { postId }, { chain, address }) {
    assert(postId.startsWith([chain, address].join(":")))
    db.posts.delete(postId)
  },
}
`

const app = await Core.initialize({ contract })
```

### Authentication in Canvas applications

We want end users to authenticate with their on-chain identities, but it's not always practical to prompt the user for a wallet signature on every interaction.

Instead, Canvas applications work with _sessions_ and _session signers_. Before a user can interact with a Canvas application, they first authorize an ephemeral session key to sign actions on their behalf. This authorization takes different forms for different chains: for Ethereum, it's a SIWE message signed by the end user's actual wallet. This chain-specific session authorization data is then wrapped in a `Session` object and added to the message log, alongside the actions themselves.

```ts
type Session<Data = unknown> = {
  type: "session"

  /** CAIP-2 prefix, e.g. "eip155:1" for mainnet Ethereum */
  chain: string
  /** CAIP-2 address (without the prefix, e.g. "0xb94d27...") */
  address: string

  /** ephemeral session key used to sign subsequent actions */
  publicKeyType: "ed25519" | "secp256k1"
  publicKey: Uint8Array

  /** chain-specific session authorization, e.g. a SIWE message & signature */
  data: Data

  blockhash: string | null
  timestamp: number
  duration: number | null
}
```

The ephemeral session key is a regular Ed25519 or Secp256k1 keypair generated and managed by a _session signer_, a class implementing the `SessionSigner` interface. There are different classes for different families of chains; `@canvas-js/chain-etherem` exports the default Ethereum-compatible `SIWESigner`.

```ts
import type { Signature } from "@canvas-js/signed-cid"
import type { Message, Action, Session } from "@canvas-js/interfaces"

interface SessionSigner {
  match: (chain: string) => boolean

  sign: (message: Message<Action | Session>) => Awaitable<Signature>
  getSession: (topic: string, options?: { chain?: string; timestamp?: number }) => Awaitable<Session>

  /**
   * Verify that `session.data` authorizes `session.publicKey`
   * to take actions on behalf of the user `${sesion.chain}:${session.address}`
   */
  verifySession: (session: Session) => Awaitable<void>
}
```

Session signer classes also handle verifying other user's sessions for the same chain family. Families of chains are expressed as `match: (chain: string) => boolean` predicates over CAIP-2 prefixes. When a Canvas app receives a new session from one of its peers, it searches its available session signers to find one matching `signer.match(session.chain)`, and uses it to verify the chain-specific authorization data with `await signer.verifySession(session)`.

Developers must provide session signers to apps at initialization via the `sessions?: SessionSigner[]` property. If none are provided, the app will add an Ethereum `SIWESigner` using a randomly generated `ethers.Wallet`. Any number of signers can be provided, even multiple instances of the same class or multiple classes matching the same family of chains.

```ts
import { BrowserProvider, Wallet } from "ethers"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const provider = new BrowserProvider(window.ethereum)
const jsonRpcSigner = await provider.getSigner()

const app = await Canvas.init({
  contract: `...`,
  signers: [
    // SIWESigner can be instantiated with any ethers.AbstractSigner,
    // e.g. a JsonRpcSigner for Metamask or an ethers.Wallet
    new SIWESigner({ signer: jsonRpcSigner }),
    new SIWESigner({ signer: Wallet.createRandom() }),
  ],
})
```

After initialization, you can control which signer is used to sign actions using either the `chain` or `signer` options of the action method:

```ts
// Use a specific signer
await app.actions.createPost({ content: "bar" }, { signer: app.signers[1] })

// Use first signer matching a certain chain
await app.actions.createPost({ content: "foo" }, { chain: "eip155:1" })

// Defaults to the first signer app.signers[0]
await app.actions.createPost({ content: "baz" })
```

Strictly speaking, you _can_ sign actions using signers that weren't provided at initialization (and thus aren't in the `app.signers` array). The caveat is that you must still have a signer matching the same family of chains in `app.signers`, or else session verification will fail.

### Configuration options

`spec` and `directory` are the only values strictly required, but in general running a `Core` involves understanding and configuring several additional properties.

```ts
declare interface CanvasConfig {
  contract: string | InlineContract

  /** NodeJS: data directory path; browser: IndexedDB database namespace */
  location?: string | null

  signers?: SessionSigner[]
  replay?: boolean
  runtimeMemoryLimit?: number

  offline?: boolean
  start?: boolean
  listen?: string[]
  announce?: string[]
  bootstrapList?: string[]
  minConnections?: number
  maxConnections?: number
}

declare interface CoreConfig extends CoreOptions {
  // Path to application data directory, or `null` to run in-memory (NodeJS only)
  directory: string | null

  // Full text of the contract to run.
  spec: string

  // Provide chain implementations for the chains declared by the contract.
  // Defaults to [new EthereumChainImplementation(1, "localhost")] if not provided.
  // Core.intialize will throw an error if there are any chains delcared by the
  // contract that have no implementations provided here.
  chains?: ChainImplementation<unknown, unknown>[]

  // Internal /ws multiaddrs to listen for libp2p connections.
  // These should be local addresses, most likely `/ip4/0.0.0.0/tcp/${port}/ws`.
  // If not provided, the core will join the libp2p mesh via the public relay servers.
  listen?: string[]

  // External /ws and /wss multiaddrs to announce to the DHT.
  // These should be publicly-resolvable, most likely `/dns4/${hostname}/tcp/${port}/wss`.
  announce?: string[]

  // Override the default list of libp2p bootstrap/relay servers.
  // Must be an array of multiaddrs for libp2p servers supporting circuit-relay v2.
  bootstrapList?: string[]
}
```

### Applying messages

Once you have a core running, you can apply messages using `core.apply`, which returns a promise resolving to an object `{ hash: string }` containin the hash of the message if it succeeds, or rejecting with an error if it fails.

```ts
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

// ...

const chain = new EthereumChainImplementation(1) // ethereum mainnet
const wallet = ethers.Wallet.createRandom()

console.log(wallet.address) // 0x6431584d547d210560Cd170CeF61cF7eE8486013

const action = await chain.signAction(wallet, {
  from: wallet.address,
  app: core.app,
  call: "createPost",
  callArgs: { content: "hello world" },
  timestamp: Date.now(),
  chain: chain.chain,
  block: null,
})

// {
//   type: 'action',
//   signature: '0xfe715f94239d5e4b8db86e424e373e9378d7e92ab392cc5996cddbebf2860eda4b0625f7be6de551ec9563b361809ae8fd6af5711c882b2c86323052d10675031c',
//   session: null,
//   payload: {
//     from: '0x6431584d547d210560Cd170CeF61cF7eE8486013',
//     app: 'ipfs://QmcHBPw1gVvrTDUbqAtNfgDBndmbBpbDmnps9CLnbH5YQk',
//     call: 'createPost',
//     callArgs: { content: 'hello world' },
//     timestamp: 1681857137057,
//     chain: 'eip155:1',
//     block: null
//   }
// }

const { hash } = await core.apply(action)
console.log(hash) // 0x4a45a783cfecab42b0b14a0fb239dc95d17df47a2d49ddb1259d431519a45c48
```

### Evaluating routes

You can evaluate the SQL routes with `core.getRoute`, which takes the full string route name and an optional object of parameter values.

```ts
const posts = await core.getRoute("/all")
// [
//   {
//     id: '0x6431584d547d210560Cd170CeF61cF7eE8486013/0x4a45a783cfecab42b0b14a0fb239dc95d17df47a2d49ddb1259d431519a45c48',
//     updated_at: 1681857375435,
//     content: 'hello world',
//     from: '0x6431584d547d210560Cd170CeF61cF7eE8486013'
//   }
// ]
```

### Get application metadata

```ts
const data = await core.getApplicationData()
// {
//   peerId: null, // null if in offline mode
//   uri: 'ipfs://QmcHBPw1gVvrTDUbqAtNfgDBndmbBpbDmnps9CLnbH5YQk',
//   cid: 'QmcHBPw1gVvrTDUbqAtNfgDBndmbBpbDmnps9CLnbH5YQk',
//   actions: [ 'createPost', 'deletePost' ],
//   routes: [ '/all' ],
//   chains: [ 'eip155:1' ],
//   peers: [],
//   merkleRoots: {}
// }
```

## Development

Regenerate the RPC protobuf message types with `npm run generate-rpc`.

The package should be built with typescript in composite build mode from the repo root, not from the package directory here.

## Testing

```
npm run test
```

## API

```typescript
import { CID } from "multiformats/cid"
import { Libp2p } from "libp2p"

import { Message, ModelValue, Model, Chain, ChainId, ApplicationData } from "@canvas-js/interfaces"

declare interface CoreOptions {
  unchecked?: boolean
  verbose?: boolean
  offline?: boolean
  replay?: boolean
}

declare interface CoreConfig extends CoreOptions {
  directory: string | null
  spec: string
  chains?: ChainImplementation<unknown, unknown>[]
  listen?: string[]
  announce?: string[]
  bootstrapList?: string[]
  uri?: string
}

declare class Core extends EventEmitter<CoreEvents> implements CoreAPI {
  public static initialize(config: CoreConfig): Promise<Core>

  public readonly app: string
  public readonly cid: CID
  public readonly directory: string | null
  public readonly libp2p: Libp2p | null

  public close(): Promise<void>
  public apply(message: Message): Promise<{ hash: string }>
  public getRoute(route: string, params: Record<string, string>): Promise<Record<string, ModelValue>[]>
  public getApplicationData(): Promise<ApplicationData>
}
```
