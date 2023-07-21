import { ModelValue } from "@canvas-js/modeldb-interface"
import { IDBPDatabase } from "idb"

export class MutableModelAPI {
	constructor(public readonly db: IDBPDatabase, public readonly model: any, options: any) {}

	public get(key: string): ModelValue | null {
		return null
	}
	public set(key: string, value: ModelValue, options: { version?: string | null; metadata?: string | null } = {}) {}
	public delete(key: string, options: { version?: string | null; metadata?: string | null } = {}) {}
	public async *iterate(): AsyncIterable<ModelValue> {}
}
export class ImmutableModelAPI {
	constructor(public readonly db: IDBPDatabase, public readonly model: any, options: any) {}

	public add(value: ModelValue, { namespace, metadata }: { namespace?: string; metadata?: string } = {}): string {
		return ""
	}
	public remove(key: string) {}
	public get(key: string): ModelValue | null {
		return null
	}
	public async *iterate(): AsyncIterable<ModelValue> {}
}
