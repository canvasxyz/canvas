import "fake-indexeddb/auto"
import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"

import type { AbstractModelDB, ModelsInit } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb/node"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb/browser"

export const testOnModelDB = (
	name: string,
	run: (t: ExecutionContext<unknown>, openDB: (models: ModelsInit) => Promise<AbstractModelDB>) => void
) => {
	const macro = test.macro(run)
	test(`Sqlite - ${name}`, macro, async (models) => new ModelDBSqlite({ path: null, models }))
	test(`IDB - ${name}`, macro, (models) => ModelDBIdb.initialize({ name: nanoid(), models }))
}

export const compareUnordered = (t: ExecutionContext, a: any[], b: any[]) => {
	t.is(a.length, b.length)

	const serializedA = a.map((x) => JSON.stringify(x)).sort()
	const serializedB = b.map((x) => JSON.stringify(x)).sort()
	t.deepEqual(serializedA, serializedB)
}

export async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const values: T[] = []
	for await (const value of iter) {
		values.push(value)
	}
	return values
}
