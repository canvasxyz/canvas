import test from "ava"

import { DocumentStore } from "@canvas-js/core"
import { ModelDB } from "@canvas-js/modeldb-sqlite"

test("save and load a document using the document store", async (t) => {
	const db = await ModelDB.open(null, { models: DocumentStore.schema })
	const ds = new DocumentStore()
	ds.db = db

	const delta = { ops: [{ insert: "hello world" }] }
	await ds.applyYjsCalls("documents", "0", [{ call: "applyDelta", delta }])

	const ds2 = new DocumentStore()
	ds2.db = db
	await ds2.loadSavedDocuments()
	const doc = ds2.getYDoc("documents", "0")

	t.deepEqual(doc.getText().toDelta(), delta.ops)
})

test("get and set id", async (t) => {
	const ds = new DocumentStore()

	t.is(ds.getId("documents", "0"), -1)
	ds.setId("documents", "0", 42)
	t.is(ds.getId("documents", "0"), 42)
	t.is(ds.getNextId("documents", "0"), 43)
})
