import { OpfsDatabase, PreparedStatement } from "@sqlite.org/sqlite-wasm"

import { SqlitePrimitiveValue } from "./encoding.js"

export class Query<
	P extends SqlitePrimitiveValue[] = SqlitePrimitiveValue[],
	R extends Record<string, SqlitePrimitiveValue> = Record<string, SqlitePrimitiveValue>,
> {
	private readonly statement: PreparedStatement

	constructor(db: OpfsDatabase, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public finalize() {
		this.statement.finalize()
	}

	public get(params: P): R | null {
		const stmt = this.statement
		try {
			if (params.length > 0) {
				stmt.bind(params)
			}

			if (!stmt.step()) {
				return null
			}

			return stmt.get({}) as R
		} finally {
			stmt.reset(true)
		}
	}

	public all(params: P): R[] {
		const stmt = this.statement

		try {
			if (params.length > 0) {
				stmt.bind(params)
			}

			const rows: R[] = []
			while (stmt.step()) {
				rows.push(stmt.get({}) as R)
			}

			return rows
		} finally {
			stmt.reset(true)
		}
	}

	public iterate(params: P): IterableIterator<R> {
		const stmt = this.statement
		if (params.length > 0) {
			stmt.bind(params)
		}

		let finished = false

		return {
			[Symbol.iterator]() {
				return this
			},

			next() {
				if (finished) {
					return { done: true, value: undefined }
				}

				const done = stmt.step()
				if (done) {
					finished = true
					stmt.reset(true)
					return { done: true, value: undefined }
				} else {
					return { done: false, value: stmt.get({}) as R }
				}
			},

			return() {
				finished = true
				stmt.reset(true)
				return { done: true, value: undefined }
			},

			throw(err: any) {
				finished = true
				stmt.reset(true)
				throw err
			},
		}
	}
}

export class Method<P extends SqlitePrimitiveValue[] = SqlitePrimitiveValue[]> {
	private readonly statement: PreparedStatement

	constructor(db: OpfsDatabase, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public finalize() {
		this.statement.finalize()
	}

	public run(params: P) {
		const stmt = this.statement
		if (params.length > 0) {
			stmt.bind(params)
		}

		try {
			stmt.step()
		} finally {
			stmt.reset(true)
		}
	}
}
