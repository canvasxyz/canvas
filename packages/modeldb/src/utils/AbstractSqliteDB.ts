import { SqlitePrimitiveValue } from "./encoding.js"

export abstract class AbstractSqliteDB {
	public abstract prepareQuery<R>(sql: string): Query<R>
	public abstract prepareMethod(sql: string): Method

	// execute something in a transaction
	public abstract transaction(fn: () => void): void
}

export abstract class Query<R> {
	public abstract get(params: SqlitePrimitiveValue[]): R | null
	public abstract all(params: SqlitePrimitiveValue[]): R[]
	public abstract iterate(params: SqlitePrimitiveValue[]): IterableIterator<R>
}

export abstract class Method {
	public abstract run(params: SqlitePrimitiveValue[]): void
}
