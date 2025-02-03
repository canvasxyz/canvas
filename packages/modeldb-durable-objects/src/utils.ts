import { SqlStorage, SqlStorageValue } from "@cloudflare/workers-types"

export class Query<R = Record<string, SqlStorageValue>> {
	constructor(private readonly db: SqlStorage, private readonly sql: string) {}

	public get(params: SqlStorageValue[]): R | null {
		const cursor = this.db.exec(this.sql, ...params)
		for (const value of cursor) {
			return value as R
		}

		return null
	}

	public all(params: SqlStorageValue[]): R[] {
		return this.db.exec(this.sql, ...params).toArray() as R[]
	}

	public iterate(params: SqlStorageValue[]): IterableIterator<R> {
		return this.db.exec(this.sql, ...params) as IterableIterator<R>
	}
}

export class Method {
	constructor(private readonly db: SqlStorage, private readonly sql: string) {}

	public run(params: SqlStorageValue[]) {
		this.db.exec(this.sql, ...params)
	}
}

// required because crypto.randomUUID may not be available in all runtimes
export const randomUUID = () => {
	return "xxxx-xxxx-xxx-xxxx".replace(/[x]/g, (c) => {
		const r = Math.floor(Math.random() * 16)
		return r.toString(16)
	})
}
