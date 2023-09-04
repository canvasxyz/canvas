# @canvas-js/modeldb-sqlite

ModelDB

- Relational
- Simple JSON schema
- Dual SQLite and IndexdDB backends
- Designed for p2p conlict resolution

```ts
import { ModelDB } from "@canvas-js/modeldb-sqlite"

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

### `ModelInit`

```ts
type PrimitiveType = "integer" | "float" | "string" | "bytes"
type OptionalPrimitiveType = `${PrimitiveType}?`
type ReferenceType = `@${string}`
type OptionalReferenceType = `@${string}?`
type RelationType = `@${string}[]`

type PropertyType = PrimitiveType | OptionalPrimitiveType | ReferenceType | OptionalReferenceType | RelationType

type IndexInit = string | string[]

type ModelsInit = Record<string, { $indexes?: IndexInit[] } & Record<string, PropertyType>>
```

### `ModelDB`

```ts
interface ModelDBOptions {
	dkLen?: number
	resolve?: (versionA: string, versionB: string) => string
}

declare class ModelDB {
	public constructor(path: string, models: ModelsInit, options?: ModelDBOptions)
	public close(): void

	public get(modelName: string, key: string): ModelValue | null
	public iterate(modelName: string): AsyncIterable<[key: string; ModelValue; version; Uint8Array | null]>
	// public query(modelName: string, query: {}): ModelValue[]

	public set(modelName: string, key: string, value: ModelValue, options?: { version?: Uint8Array | null }): void
	public delete(modelName: string, key: string, options?: { version?: Uint8Array | null }): void

	public add(modelName: string, value: ModelValue): string
}
```
