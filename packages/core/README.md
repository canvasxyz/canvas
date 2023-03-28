# @canvas-js/core

> ⚠️ In most cases, you want to use the Canvas CLI or the [hub](https://canvas-hub.fly.dev/) to run apps. `@canvas-js/core` is an internal component for embedded use cases.

The Canvas core verifies, executes, and stores the effects of signed messages.
Most developers should not use the core directly, but instead should use the Canvas CLI or Hub,
which will automatically set up and manage cores and their dependencies.

### Initializing a core

To initialize an Canvas core, import `@canvas-js/core` and call `Core.initialize({})` with the appropriate arguments.

```typescript
import { Core } from "@canvas-js/core"

const spec = `
  const models = { }
  const routes = { }
  const actions = { }
`

const core = await Core.initialize({
	spec,
	directory: "/path/to/app/directory", // or `null` to run entirely in-memory
	unchecked: true,
})

console.log(core.app) // ipfs://Qm...
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
	// pass `null` to run in memory (NodeJS only)
	directory: string | null
	spec: string

	uri?: string // set a custom app URI (defaults to ipfs:// of spec)
	chains?: ChainImplementation<unknown, unknown>[]
	listen?: string[]
	announce?: string[]
	bootstrapList?: string[]
}

declare class Core extends EventEmitter<CoreEvents> implements CoreAPI {
	public static initialize(config: CoreConfig): Promise<Core>

	public readonly app: string
	public readonly cid: CID
	public readonly directory: string | null
	public readonly libp2p: Libp2p | null // null if config.offline = true

	public close(): Promise<void>
	public apply(message: Message): Promise<{ hash: string }>
	public getRoute(route: string, params: Record<string, string>): Promise<Record<string, ModelValue>[]>
	public getApplicationData(): Promise<ApplicationData> // general app metadata and network/peering status
}
```

## Metrics

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
