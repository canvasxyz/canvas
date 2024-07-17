import { BindingSpec, OpfsDatabase, PreparedStatement, SqlValue } from "@sqlite.org/sqlite-wasm"

export class Query<P extends BindingSpec, R> {
	private readonly statement: PreparedStatement

	constructor(
		db: OpfsDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepare(sql)
	}

	public get(params: P): R | null {
		const statement = this.statement

		try {
			statement.bind(params)
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
		try {
			statement.bind(params)
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
		try {
			statement.bind(params)
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

export class Method<P extends BindingSpec> {
	private readonly statement: PreparedStatement

	constructor(
		db: OpfsDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		const statement = this.statement
		statement.bind(params)
		statement.step()
		statement.reset(true)
	}
}
