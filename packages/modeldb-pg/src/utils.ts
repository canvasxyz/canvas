import pg from "pg"
import Cursor from "pg-cursor"

import { PostgresPrimitiveValue } from "./encoding.js"

export class Query<R extends Record<string, PostgresPrimitiveValue> = Record<string, PostgresPrimitiveValue>> {
	constructor(private readonly client: pg.Client, private readonly sql: string) {}

	public async get(params: PostgresPrimitiveValue[]): Promise<R | null> {
		const {
			rows: [result = null],
		} = await this.client.query<R, PostgresPrimitiveValue[]>(this.sql, params)

		return result
	}

	public async all(params: PostgresPrimitiveValue[]): Promise<R[]> {
		const { rows } = await this.client.query<R, PostgresPrimitiveValue[]>(this.sql, params)
		return rows
	}

	public async *iterate(
		params: PostgresPrimitiveValue[],
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
	constructor(private readonly client: pg.Client, private readonly sql: string) {}

	public async run(params: PostgresPrimitiveValue[]) {
		await this.client.query<{}, PostgresPrimitiveValue[]>(this.sql, params)
	}
}
