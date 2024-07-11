import { OpfsDatabase, PreparedStatement } from "@sqlite.org/sqlite-wasm"

type Params = Record<`p${string}`, string | number | Buffer | null>

export class Query<P, R> {
	private readonly statement: PreparedStatement

	constructor(
		db: OpfsDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepare(sql)
	}

	public get(params: Params): R | null {
		try {
			this.statement.bind(params)
			const result = this.statement.get({}) as R | null
			return result ?? null
		} finally {
			this.statement.clearBindings()
		}
	}

	public all(params: Params): R[] {
		try {
			this.statement.bind(params)
			const result = []
			while (this.statement.step()) {
				result.push(this.statement.get({}) as R)
			}
			return result
		} finally {
			this.statement.clearBindings()
		}
	}

	public iterate(params: P): IterableIterator<R> {
		return this.statement.iterate(params) as IterableIterator<R>
	}
}

export class Method<P> {
	private readonly statement: PreparedStatement

	constructor(
		db: OpfsDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepare(sql)
	}

	public run(params: P) {
		this.statement.run(params)
	}
}
