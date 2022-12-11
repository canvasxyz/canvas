/**
 * Canvas query builder.
 *
 * For SQLite prepared statements: https://www.sqlite.org/c3ref/bind_blob.html
 * For better-sqlite3: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#class-statement
 */

// Not yet supported: Buffer (blob), BigInt (integer)
type QueryArg = string | number | null

export type QueryBuilder = {
	query: (q: string, args?: QueryArg[] | Record<string, QueryArg>) => QueryBuilderResult
	// select: ...
}

export class QueryBuilderResult {
	public query: string
	public args: QueryArg[] | Record<string, QueryArg> | undefined
	constructor(query: string, args?: QueryArg[] | Record<string, QueryArg>) {
		this.query = query
		this.args = args
	}
}
