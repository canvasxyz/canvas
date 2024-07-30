import { OpfsDatabase, PreparedStatement, SqlValue } from "@sqlite.org/sqlite-wasm"

export class Query<P extends { [column: string]: SqlValue }, R> {
	private readonly statement: PreparedStatement

	constructor(
		db: OpfsDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepare(sql)
	}

	public get(params: P): R | null {
		const statement = this.statement

		const paramsWithColons = Object.fromEntries(Object.entries(params).map(([key, value]) => [":" + key, value]))

		try {
			if (Object.keys(paramsWithColons).length > 0) statement.bind(paramsWithColons)
			if (!statement.step()) {
				return null
			}
			return statement.get({}) as R
		} finally {
			statement.reset(true)
		}
	}

	public all(params: P): R[] {
		const statement = this.statement
		const paramsWithColons = Object.fromEntries(Object.entries(params).map(([key, value]) => [":" + key, value]))
		try {
			if (Object.keys(paramsWithColons).length > 0) statement.bind(paramsWithColons)
			const result = []
			while (statement.step()) {
				result.push(statement.get({}) as R)
			}
			return result
		} finally {
			statement.reset(true)
		}
	}

	public iterate(params: P): IterableIterator<R> {
		const statement = this.statement
		const paramsWithColons = Object.fromEntries(Object.entries(params).map(([key, value]) => [":" + key, value]))
		try {
			if (Object.keys(paramsWithColons).length > 0) statement.bind(paramsWithColons)
			return {
				[Symbol.iterator]() {
					return this
				},
				next() {
					const done = statement.step()
					if (done) {
						return { done: true, value: undefined }
					} else {
						return { done: false, value: statement.get({}) as R }
					}
				},
			}
		} finally {
			statement.reset(true)
		}
	}
}

export class Method<P extends { [column: string]: SqlValue }> {
	private readonly statement: PreparedStatement

	constructor(
		db: OpfsDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		const statement = this.statement
		const paramsWithColons = Object.fromEntries(Object.entries(params).map(([key, value]) => [":" + key, value]))
		if (Object.keys(paramsWithColons).length > 0) statement.bind(paramsWithColons)
		statement.step()
		statement.reset(true)
	}
}
