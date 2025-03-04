import test from "ava"
import * as Y from "yjs"

import { Canvas, Config } from "@canvas-js/core"

test("snapshot persists data across apps", async (t) => {
	const config: Config = {
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
				},
				documents: {
					id: "primary",
					content: "yjs-doc",
				},
			},
			actions: {
				async createPost(db, { id, content }: { id: string; content: string }) {
					await db.set("posts", { id, content })
				},
				async deletePost(db, { id }: { id: string }) {
					await db.delete("posts", id)
				},
				async insertIntoDocument(db, key, index, text) {
					await db.yjsInsert("documents", key, index, text)
				},
				async deleteFromDocument(db, key, index, length) {
					await db.yjsDelete("documents", key, index, length)
				},
			},
		},
	}

	const app = await Canvas.initialize(config)

	const [clock0, parents0] = await app.messageLog.getClock()
	t.is(clock0, 1)
	t.is(parents0.length, 0)

	await app.actions.createPost({ id: "a", content: "foo" })
	await app.actions.createPost({ id: "b", content: "bar" })
	await app.actions.createPost({ id: "c", content: "qux" })
	await app.actions.createPost({ id: "d", content: "baz" })
	await app.actions.deletePost({ id: "b" })
	await app.actions.deletePost({ id: "d" })
	await app.actions.insertIntoDocument("e", 0, "Hello, world")
	await app.actions.deleteFromDocument("e", 5, 7)

	const [clock, parents] = await app.messageLog.getClock()
	t.is(clock, 12) // one session, eight actions, two "updates" messages
	t.is(parents.length, 1)

	// snapshot and add some more actions
	const snapshot = await app.createSnapshot()
	await app.stop()

	const app2 = await Canvas.initialize({ reset: true, snapshot, ...config })

	t.is((await app2.db.get("posts", "a"))?.content, "foo")
	t.is(await app2.db.get("posts", "b"), null)
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is(await app2.db.get("posts", "e"), null)

	const docDiff1 = await app2.db.get("documents:state", "e")
	const doc1 = new Y.Doc()
	Y.applyUpdate(doc1, docDiff1!.content)
	t.is(doc1.getText().toJSON(), "Hello")

	await app2.actions.createPost({ id: "a", content: "1" })
	await app2.actions.createPost({ id: "b", content: "2" })
	await app2.actions.createPost({ id: "e", content: "3" })
	await app2.actions.createPost({ id: "f", content: "4" })
	await app2.actions.insertIntoDocument("e", 6, "?")

	const [clock2, parents2] = await app2.messageLog.getClock()
	t.is(clock2, 9) // one snapshot, one session, four actions
	t.is(parents2.length, 1)

	t.is((await app2.db.get("posts", "a"))?.content, "1")
	t.is((await app2.db.get("posts", "b"))?.content, "2")
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is((await app2.db.get("posts", "e"))?.content, "3")
	t.is((await app2.db.get("posts", "f"))?.content, "4")
	const docDiff2 = await app2.db.get("documents:state", "e")
	const doc2 = new Y.Doc()
	Y.applyUpdate(doc2, docDiff2!.content)
	t.is(doc2.getText().toJSON(), "Hello?")

	// snapshot a second time
	const snapshot2 = await app2.createSnapshot()
	const app3 = await Canvas.initialize({ reset: true, snapshot: snapshot2, ...config })

	t.is((await app3.db.get("posts", "a"))?.content, "1")
	t.is((await app3.db.get("posts", "b"))?.content, "2")
	t.is((await app3.db.get("posts", "c"))?.content, "qux")
	t.is(await app3.db.get("posts", "d"), null)
	t.is((await app3.db.get("posts", "e"))?.content, "3")
	t.is((await app3.db.get("posts", "f"))?.content, "4")
	t.is(await app3.db.get("posts", "g"), null)
	const docDiff3 = await app3.db.get("documents:state", "e")
	const doc3 = new Y.Doc()
	Y.applyUpdate(doc3, docDiff3!.content)
	t.is(doc3.getText().toJSON(), "Hello?")

	const [clock3] = await app3.messageLog.getClock()
	t.is(clock3, 2) // one snapshot
	t.is(parents2.length, 1)
})
