import type * as sqlite from "better-sqlite3"
import {
	Query as AbstractQuery,
	Method as AbstractMethod,
	SqlitePrimitiveValue,
} from "@canvas-js/modeldb-sqlite-shared"
export class Query<R> extends AbstractQuery<R> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		super()
		this.statement = db.prepare(sql)
	}

	public get(params: SqlitePrimitiveValue[]): R | null {
		const result = this.statement.get(...params) as R | undefined
		return result ?? null
	}

	public all(params: SqlitePrimitiveValue[]): R[] {
		return this.statement.all(...params) as R[]
	}

	public iterate(params: SqlitePrimitiveValue[]): IterableIterator<R> {
		return this.statement.iterate(...params) as IterableIterator<R>
	}
}

export class Method extends AbstractMethod {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		super()
		this.statement = db.prepare(sql)
	}

	public run(params: SqlitePrimitiveValue[]) {
		this.statement.run(...params)
	}
}
