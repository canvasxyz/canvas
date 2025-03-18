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
