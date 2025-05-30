import * as pg from "pg"
import Cursor from "pg-cursor"

import { PostgresPrimitiveValue } from "./encoding.js"

export type PgClient = InstanceType<typeof pg.Client>

export const quote = (name: string) => `"${name}"`

export class Query<R extends Record<string, PostgresPrimitiveValue> = Record<string, PostgresPrimitiveValue>> {
	constructor(private readonly client: PgClient, private readonly sql: string) {}

	public async get(params: PostgresPrimitiveValue[] | PostgresPrimitiveValue[][]): Promise<R | null> {
		const { rows } = await this.client.query<R, PostgresPrimitiveValue[] | PostgresPrimitiveValue[][]>(this.sql, params)
		const [result = null] = rows
		return result
	}

	public async all(params: PostgresPrimitiveValue[] | PostgresPrimitiveValue[][]): Promise<R[]> {
		const { rows } = await this.client.query<R, PostgresPrimitiveValue[] | PostgresPrimitiveValue[][]>(this.sql, params)
		return rows
	}

	public async *iterate(
		params: PostgresPrimitiveValue[] | PostgresPrimitiveValue[][],
		options: { pageSize?: number } = {},
	): AsyncIterableIterator<R> {
		const maxRows = options.pageSize ?? 512

		const cursor = this.client.query(new Cursor<R>(this.sql, params))
		let resultCount
		try {
			do {
				const results = await cursor.read(maxRows)
				resultCount = results.length
				yield* results
			} while (resultCount > 0)
		} finally {
			await cursor.close()
		}
	}
}

export class Method {
	constructor(private readonly client: PgClient, private readonly sql: string) {}

	public async run(params: PostgresPrimitiveValue[]) {
		const result = await this.client.query<{}, PostgresPrimitiveValue[]>(this.sql, params)
	}
}
