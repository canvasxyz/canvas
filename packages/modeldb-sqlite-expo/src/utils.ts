import { SQLiteBindValue, SQLiteDatabase, SQLiteStatement } from "expo-sqlite"

export class Query<P extends Record<string, SQLiteBindValue>, R> {
	private readonly statement: SQLiteStatement

	constructor(
		db: SQLiteDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepareSync(sql)
	}

	public get(params: P): R | null {
		const result = this.statement.executeSync(params) as R | undefined
		return result ?? null
	}

	public all(params: P): R[] {
		return this.statement.executeSync(params).getAllSync() as R[]
	}

	public iterate(params: P): IterableIterator<R> {
		return this.statement.executeSync(params)
	}
}

export class Method<P extends Record<string, SQLiteBindValue>> {
	private readonly statement: SQLiteStatement

	constructor(
		db: SQLiteDatabase,
		private readonly sql: string,
	) {
		this.statement = db.prepareSync(sql)
	}

	public run(params: P) {
		this.statement.executeSync(params)
	}
}
