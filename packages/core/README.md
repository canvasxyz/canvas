# @canvas-js/core

A programmable append-only log for peer-to-peer decentralized applications.

## API

```typescript
import { ethers } from "ethers"
import { Libp2p } from "libp2p"

import { Action, Session, ModelValue, Model, Chain, ChainId } from "@canvas-js/interfaces"

interface CoreConfig {
	// pass `null` to run in memory
	directory: string | null
	// defaults to ipfs:// hash of app
	uri?: string
	app: string
	libp2p?: Libp2p
	providers?: Record<string, ethers.providers.JsonRpcProvider>
	// defaults to fetching each block from the provider with no caching
	blockResolver?: BlockResolver
	unchecked?: boolean
	verbose?: boolean
	offline?: boolean
}

type BlockResolver = (chain: Chain, chainId: ChainId, block: string) => Promise<ethers.providers.Block>

declare class Core {
	static initialize(config: CoreConfig): Promise<Core>

	readonly uri: string
	readonly cid: CID
	readonly directory: string | null
	readonly models: Record<string, Model>
	readonly actions: string[]
	readonly routeParameters: Record<string, string[]>

	close(): Promise<void>
	getRoute(route: string, params: Record<string, ModelValue>): Record<string, ModelValue>[]
	applyAction(action: Action): Promise<{ hash: string }>
	applySession(session: Session): Promise<{ hash: string }>
}
```

`CoreConfig.uri` must be the `ipfs://` CIDv0 URI of the app (dag-pb using the default chunking settings), or a local `file:///` URI.

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

(c) 2022 Canvas Technology Corporation
