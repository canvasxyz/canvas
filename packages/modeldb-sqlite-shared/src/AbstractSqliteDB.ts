import { SqlValue } from "./encoding.js"

export abstract class AbstractSqliteDB {
	// exec ? or maybe always prepare
	// i don't think we really need a separate Method class
	// prepareMethod
	// prepareQuery

	public abstract prepareQuery(sql: string): Query
	public abstract prepareMethod(sql: string): Method

	// execute something in a transaction
	public abstract transaction(fn: () => void): void
}

export abstract class Query {
	public abstract get(params: Record<string, SqlValue>): Record<string, SqlValue> | null
	public abstract all(params: Record<string, SqlValue>): Record<string, SqlValue>[]
	public abstract iterate(params: Record<string, SqlValue>): IterableIterator<any>
}

export abstract class Method {
	public abstract run(params: Record<string, SqlValue>): void
}
