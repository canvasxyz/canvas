import type sqlite from "better-sqlite3"
import { SqlitePrimitiveValue } from "./encoding.js"

export class Query<P = SqlitePrimitiveValue[], R = Record<string, SqlitePrimitiveValue>> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public get(params: P): R | null {
		const result = this.statement.get(params) as R | undefined
		return result ?? null
	}

	public all(params: P): R[] {
		return this.statement.all(params) as R[]
	}

	public iterate(params: P): IterableIterator<R> {
		return this.statement.iterate(params) as IterableIterator<R>
	}
}

export class Method<P = SqlitePrimitiveValue[]> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		this.statement.run(params)
	}
}
