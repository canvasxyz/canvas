export abstract class AbstractSqliteDB {
	// exec ? or maybe always prepare
	// i don't think we really need a separate Method class
	// prepareMethod
	// prepareQuery

	public abstract prepareQuery<P, R>(sql: string): Query<P, R>
	public abstract prepareMethod<P>(sql: string): Method<P>

	// execute something in a transaction
	public abstract transaction(fn: () => void): void
}

export abstract class Query<P, R> {
	public abstract get(params: P): R | null
	public abstract all(params: P): R[]
	public abstract iterate(params: P): IterableIterator<R>
}

export abstract class Method<P> {
	public abstract run(params: P): void
}
