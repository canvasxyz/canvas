# @canvas-js/modeldb

ModelDB

- Relational
- Simple JSON schema
- Dual SQLite and IndexdDB backends
- Designed for p2p conlict resolution
- "Mutable" and "immutable" models

```ts
import { ModelDB } from "@canvas-js/modeldb"

const db = new ModelDB({
	user: {
		address: "string",
		encryptionPublicKey: "bytes",
		signingPublicKey: "bytes",
	},

	room: {
		creator: "@user",
		members: "@user[]",
		$indexes: ["members"],
	},

	message: {
		room: "@room",
		sender: "@user",
		content: "string",
		timestamp: "integer",
	},
})

const userId = modelDB.add("user", {
	address: "a",
	encryptionPublicKey: new Uint8Array([1, 2, 3]),
	signingPublicKey: new Uint8Array([4, 5, 6]),
})
```

```ts
declare class ModelDB {
	public constructor(path: string, models: ModelsInit, options?: Options)
	public close(): void

	public get(modelName: string, key: string): ModelValue | null
	public iterate(modelName: string): AsyncIterable<ModelValue>
	public query(modelName: string, query: {}): ModelValue[]

	public set(modelName: string, key: string, value: ModelValue, options?: { metadata?: string; version?: string }): void
	public delete(modelName: string, key: string, options?: { metadata?: string; version?: string }): void
	public add(modelName: string, value: ModelValue, options?: { metadata?: string; namespace?: string }): string
	public remove(modelName: string, key: string): void
}
```
