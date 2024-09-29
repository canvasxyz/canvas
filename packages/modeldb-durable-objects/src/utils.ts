import { SqlStorage } from "@cloudflare/workers-types"

export class Query<R> {
	constructor(
		private readonly db: SqlStorage,
		private readonly sql: string,
	) {}

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

export class Method<P> {
	constructor(
		private readonly db: SqlStorage,
		private readonly sql: string,
	) {}

	public run(params: any[]) {
		this.db.exec(this.sql, ...params)
	}
}
