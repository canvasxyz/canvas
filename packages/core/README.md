# @canvas-js/core

> ⚠️ In most cases, you want to use the Canvas CLI or the [hub](https://canvas-hub.fly.dev/) to run apps. `@canvas-js/core` is an internal component for embedded use cases.

The Canvas core verifies, executes, and stores the effects of signed messages.
Most developers should not use the core directly, but instead should use the Canvas CLI or Hub,
which will automatically set up and manage cores and their dependencies.

### Initializing a core

To initialize an Canvas core, import `@canvas-js/core` and call `Core.initialize({})` with the appropriate arguments.

```typescript
import { Core, getLibp2pInit } from "@canvas-js/core"
import { createLibp2p } from "libp2p"
import { createEd25519PeerId } from "@libp2p/peer-id-factory"

const spec = `
  const models = { }
  const routes = { }
  const actions = { }
`

// persist and re-use peer IDs whever possible
const peerId = await createEd25519PeerId()
const libp2p = await createLibp2p(getLibp2pInit({ peerId }))

const core = await Core.initialize({
	spec,
	directory: "/path/to/app/directory", // or `null` to run entirely in-memory
	libp2p,
	unchecked: true,
})

console.log(core.app) // ipfs://...
```

Applications are identified by the `core.app` IPFS URI. Sessions and actions must be signed for the core's app URI.

## Development

Regenerate the RPC protobuf message types with `npm run generate-rpc`.

The package should be built with typescript in composite build mode from the repo root, not from the package directory here.

## Testing

```
npm run test
```

## API

```typescript
import { ethers } from "ethers"
import { Libp2p } from "libp2p"

import { Action, Session, ModelValue, Model, Chain, ChainId } from "@canvas-js/interfaces"

interface CoreOptions {
	unchecked?: boolean
	verbose?: boolean
}

interface CoreConfig extends CoreOptions {
	// pass `null` to run in memory
	directory: string | null
	spec: string

	uri?: string // defaults to the ipfs:// hash of the spec
	libp2p: Libp2p | null // pass null to run offline

	// defaults to an EthereumChainImplementation with no provider
	chains?: ChainImplementation<unknown, unknown>[]
}

declare class Core {
	static initialize(config: CoreConfig): Promise<Core>

	readonly app: string
	readonly directory: string | null

	close(): Promise<void>
	getRoute(route: string, params: Record<string, string>): Promise<Record<string, ModelValue>[]>
	applyAction(action: Action): Promise<{ hash: string }>
	applySession(session: Session): Promise<{ hash: string }>
}
```

`CoreConfig.uri` must be the `ipfs://` CIDv0 URI of the app (dag-pb using the default chunking settings), or a local `file:///` URI.

## Metrics

These are registered with a custom registry exported as `canvasRegister` from [src/metrics.ts](./src/metrics.ts).

### `canvas_sync_time`

A histogram of MST sync times.

| label name | type     | description                       |
| ---------- | -------- | --------------------------------- |
| `uri`      | `string` | the source `ipfs://` URI          |
| `status`   | `string` | either `"success"` or `"failure"` |

### `canvas_messages`

A counter of messages applied

| label name | type     | description                      |
| ---------- | -------- | -------------------------------- |
| `type`     | `string` | either `"action"` or `"session"` |
| `uri`      | `string` | the source `ipfs://` URI         |

### `canvas_gossipsub_subscribers`

A gauge counting GossipSub topic subscribers.

| label name | type     | description              |
| ---------- | -------- | ------------------------ |
| `uri`      | `string` | the source `ipfs://` URI |

### `canvas_sync_peers`

A gauge counting the observed active DHT application peers.

| label name | type     | description              |
| ---------- | -------- | ------------------------ |
| `uri`      | `string` | the source `ipfs://` URI |
