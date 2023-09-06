import "fake-indexeddb/auto"
import test, { ExecutionContext } from "ava"
import { varint } from "multiformats/basics"
import { nanoid } from "nanoid"
import { AbstractModelDB, ModelsInit, ModelDBOptions } from "@canvas-js/modeldb-interface"
import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { ModelDB as ModelDBIdb } from "@canvas-js/modeldb-idb"

// Create simple version values from revision numbers
export const v = (revision: number) => varint.encodeTo(revision, Buffer.alloc(varint.encodingLength(revision)))

export const testOnModelDB = (
	name: string,
	run: (
		t: ExecutionContext<unknown>,
		openDB: (models: ModelsInit, options?: ModelDBOptions) => Promise<AbstractModelDB>
	) => void
) => {
	const macro = test.macro(run)
	test(`Sqlite - ${name}`, macro, async (models, options) => new ModelDBSqlite(":memory:", models, options))
	// test(`IDB - ${name}`, macro, (models, options) => ModelDBIdb.initialize(nanoid(), models, options))
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
