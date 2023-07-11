import { CBORValue } from "microcbor"

type Env = Record<string, CBORValue>

type Context = { id: string; timestamp: number; revision: Uint8Array; publicKey: Uint8Array; address?: string }

interface FormatImplementation<T> {
	encode: (payload: T) => Promise<Uint8Array>
	decode: (bytes: Uint8Array) => T
}

interface SourceConfig<T> {
	topic: string
	format: "cbor" | "json" | FormatImplementation<T>
	authenticate: () => {}
}

type ModelRecord = Record<string, string | number | boolean | Uint8Array | null>

interface DatabaseModel<T extends ModelRecord = ModelRecord> {
	// immutable model methods
	get: (id: string) => T | null
	add: (record: T) => string

	// mutable model methods
	set: (id: string, record: T) => void
	delete: (id: string) => void
}

type Database = Record<string, DatabaseModel>

interface ActionConfig<T, I = void> {
	schema?: {}
	source?: string | SourceConfig<T>
	create?: (params: I) => Promise<T>
	apply?: (db: Database, payload: T, ctx?: Context) => Promise<void>
}
