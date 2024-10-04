import type * as sqlite from "better-sqlite3"
import { Query as AbstractQuery, SqlValue } from "@canvas-js/modeldb-sqlite-shared"

export class Query extends AbstractQuery {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		super()
		this.statement = db.prepare(sql)
	}

	public get(params: Record<string, SqlValue>): Record<string, SqlValue> | null {
		const result = this.statement.get(params)
		return (result ?? null) as Record<string, SqlValue> | null
	}

	public all(params: Record<string, SqlValue>): Record<string, SqlValue>[] {
		return this.statement.all(params) as Record<string, SqlValue>[]
	}

	public iterate(params: Record<string, SqlValue>): IterableIterator<Record<string, SqlValue>> {
		return this.statement.iterate(params) as IterableIterator<Record<string, SqlValue>>
	}
}

export class Method<P> {
	private readonly statement: sqlite.Statement

	constructor(db: sqlite.Database, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		this.statement.run(params)
	}
}
