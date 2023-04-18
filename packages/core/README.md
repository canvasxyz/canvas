# @canvas-js/core

A `Core` verifies, executes, and applies the effects of signed messages.

> ⚠️ The simplest way to run a Canvas application is to use the [CLI](https://github.com/canvasxyz/canvas/tree/main/packages/cli) or Canvas Hub (coming soon). Only use `@canvas-js/core` directly if you're embedding a Canvas app in a browser context or other JavaScript system.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
	- [Initialize](#initialize)
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

### Initialize

To initialize a core, import `@canvas-js/core` and call `Core.initialize({ ... })` with the contract and path to application data directory.

```ts
import { Core } from "@canvas-js/core"

const contract = `// A sample Canvas application
export const models = {
	posts: {
		id: "string",
		updated_at: "datetime",
		from: "string",
		content: "string",
	}
}

export const actions = {
	createPost({ content }, { hash, from, db }) {
		const postId = from + "/" + hash
		db.posts.set(postId, { content })
	},
	deletePost({ postId }, { from, db }) {
		assert(postId.startsWith(from + "/"))
		db.posts.delete(postId)
	},
}

export const routes = { 
	"/all": ({}) => "SELECT * FROM posts"
}
`

const core = await Core.initialize({
	spec: contract,
	directory: null, // run in-memory
	unchecked: true, // don't require blockhashes
	offline: true,   // don't start libp2p
})

console.log(core.app) // ipfs://QmTFwv6NF78V64CVdWrabYhQhmV4bWJw63aTRcVhvBAU2u
```

Applications are identified by the `ipfs://...` hash of the contract. Sessions and actions must have contract's `ipfs://...` URI in `payload.app`.

### Configuration options

`spec` and `directory` are the only values strictly required, but in general running a `Core` involves understanding and configuring several additional properties.

```ts
declare interface CoreOptions {
	unchecked?: boolean // don't require or validate blockhashes in messages
	verbose?: boolean // print verbose logging to stdout
	offline?: boolean // disable libp2p
	replay?: boolean  // replay the entire message log on start-up
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

	// Set a custom app URI. Defaults to ipfs:// of spec. Don't use this!
	uri?: string
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
