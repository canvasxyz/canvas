import "fake-indexeddb/auto"
import test, { ExecutionContext } from "ava"
import { varint } from "multiformats/basics"
import { nanoid } from "nanoid"

import type { AbstractModelDB, ModelsInit, ModelDBOptions } from "@canvas-js/modeldb"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb/node"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb/browser"

// Create simple version values from revision numbers
export const v = (revision: number) => varint.encodeTo(revision, new Uint8Array(varint.encodingLength(revision)))

export const testOnModelDB = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openDB: (models: ModelsInit, options?: ModelDBOptions) => Promise<AbstractModelDB>
	) => void
) => {
	const macro = test.macro(run)
	test(`Sqlite - ${name}`, macro, async (models, options) => new ModelDBSqlite(":memory:", models, options))
	test(`IDB - ${name}`, macro, (models, options) => ModelDBIdb.initialize(nanoid(), models, options))
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
