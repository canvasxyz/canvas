import { SQLiteBindValue, SQLiteDatabase, SQLiteStatement } from "expo-sqlite"

export class Query<
	P extends SQLiteBindValue[] = SQLiteBindValue[],
	R extends Record<string, SQLiteBindValue> = Record<string, SQLiteBindValue>,
> {
	private readonly statement: SQLiteStatement

	constructor(db: SQLiteDatabase, private readonly sql: string) {
		this.statement = db.prepareSync(sql)
	}

	public finalize() {
		this.statement.finalizeSync()
	}

	public get(params: P): R | null {
		return this.statement.executeSync<R>(params).getFirstSync()
	}

	public all(params: P): R[] {
		return this.statement.executeSync<R>(params).getAllSync()
	}

	public iterate(params: P): IterableIterator<R> {
		return this.statement.executeSync(params)
	}
}

export class Method<P extends SQLiteBindValue[] = SQLiteBindValue[]> {
	private readonly statement: SQLiteStatement

	constructor(db: SQLiteDatabase, private readonly sql: string) {
		this.statement = db.prepareSync(sql)
	}

	public finalize() {
		this.statement.finalizeSync()
	}

	public run(params: P) {
		this.statement.executeSync(params)
	}
}
