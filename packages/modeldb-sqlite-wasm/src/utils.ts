import { SqlitePrimitiveValue } from "@canvas-js/modeldb-sqlite-shared"
import { OpfsDatabase, PreparedStatement } from "@sqlite.org/sqlite-wasm"

export class Query<R> {
	private readonly statement: PreparedStatement

	constructor(db: OpfsDatabase, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public get(params: SqlitePrimitiveValue[]): R | null {
		const statement = this.statement

		try {
			if (params.length > 0) statement.bind(params)
			if (!statement.step()) {
				return null
			}
			return statement.get({}) as R
		} finally {
			statement.reset(true)
		}
	}

	public all(params: SqlitePrimitiveValue[]): R[] {
		const statement = this.statement

		try {
			if (params.length > 0) statement.bind(params)
			const result = []
			while (statement.step()) {
				result.push(statement.get({}) as R)
			}
			return result
		} finally {
			statement.reset(true)
		}
	}

	public *iterate(params: SqlitePrimitiveValue[]): IterableIterator<R> {
		const statement = this.statement
		if (params.length > 0) statement.bind(params)

		const iter: IterableIterator<R> = {
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

		try {
			yield* iter
		} finally {
			statement.reset(true)
		}
	}
}

export class Method {
	private readonly statement: PreparedStatement

	constructor(db: OpfsDatabase, private readonly sql: string) {
		this.statement = db.prepare(sql)
	}

	public run(params: SqlitePrimitiveValue[]) {
		const statement = this.statement
		if (params.length > 0) statement.bind(params)
		statement.step()
		statement.reset(true)
	}
}
