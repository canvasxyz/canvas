import { SqlStorage } from "@cloudflare/workers-types"

export class Query<R> {
	constructor(private readonly db: SqlStorage, private readonly sql: string) {}

	public get(params: any[]): R | null {
		try {
			return this.db.exec(this.sql, ...params).one() as R
		} catch (err) {
			return null
		}
	}

	public all(params: any[]): R[] {
		return this.db.exec(this.sql, ...params).toArray() as R[]
	}

	public iterate(params: any[]): IterableIterator<R> {
		return this.db.exec(this.sql, ...params) as IterableIterator<R>
	}
}

export class Method {
	constructor(private readonly db: SqlStorage, private readonly sql: string) {}

	public run(params: any[]) {
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
