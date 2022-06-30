# @canvas-js/core

A programmable append-only log for peer-to-peer decentralized applications.

```typescript
import { QuickJSWASMModule } from "quickjs-emscripten"

import { Action, ActionResult, Session, ModelValue, Model } from "@canvas-js/interfaces"

interface CoreConfig {
	name: string
	directory: string | null
	spec: string
	quickJS: QuickJSWASMModule
	replay?: boolean
	development?: boolean
}

declare class Core {
	static initialize(config: CoreConfig): Promise<Core>

	readonly name: string
	readonly directory: string | null
	readonly models: Record<string, Model>
	readonly routeParameters: Record<string, string[]>
	readonly actionParameters: Record<string, string[]>

	close(): Promise<void>
	getRoute(route: string, params?: Record<string, ModelValue>): Record<string, ModelValue>[]
	apply(action: Action): Promise<ActionResult>
	session(session: Session): Promise<void>
	getSessionStream(options?: { limit?: number }): AsyncIterable<[string, Action]>
	getActionStream(options?: { limit?: number }): AsyncIterable<[string, Action]>
}
```

`CoreConfig.name` must be the IPFS multihash of the spec (dag-pb using the default chunking settings), unless `CoreConfig.development` is set to `true`, in which case `CoreConfig.name` can be any string (typically a local path or filename).

(c) 2022 Canvas Technology Corporation
