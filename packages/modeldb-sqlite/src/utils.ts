import type * as sqlite from "better-sqlite3"
import {
	Query as AbstractQuery,
	Method as AbstractMethod,
	SqlitePrimitiveValue,
} from "@canvas-js/modeldb-sqlite-shared"
export class Query<P extends { [column: string]: SqlitePrimitiveValue }, R> extends AbstractQuery<P, R> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		super()
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

export class Method<P extends { [column: string]: SqlitePrimitiveValue }> extends AbstractMethod<P> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		super()
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		this.statement.run(params)
	}
}
