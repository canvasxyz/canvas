import assert from "node:assert"
import test from "ava"
import * as json from "@ipld/dag-json"
import Prando from "prando"

import { ethers } from "ethers"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { Canvas, Contract, createSnapshot } from "@canvas-js/core"

const rng = new Prando.default()

const random = (n: number) => rng.nextInt(0, n - 1)

test("snapshot persists data across apps", async (t) => {
	const wallet = ethers.Wallet.createRandom()
	const contract = {
		models: {
			posts: {
				id: "primary",
				content: "string",
			},
		},
		actions: {
			async createPost(db, { id, content }: { id: string; content: string }) {
				await db.set("posts", { id, content })
			},
			async deletePost(db, { id }: { id: string }) {
				await db.delete("posts", id)
			},
		},
	} satisfies Contract

	const config = {
		topic: "com.example.app",
		contract,
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

	const [clock, parents] = await app.messageLog.getClock()
	t.is(clock, 8) // one session, six actions
	t.is(parents.length, 1)

	// snapshot and add some more actions
	const snapshot = await createSnapshot(app)
	await app.stop()

	const app2 = await Canvas.initialize({ reset: true, snapshot, ...config })

	t.is((await app2.db.get("posts", "a"))?.content, "foo")
	t.is(await app2.db.get("posts", "b"), null)
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is(await app2.db.get("posts", "e"), null)

	await app2.actions.createPost({ id: "a", content: "1" })
	await app2.actions.createPost({ id: "b", content: "2" })
	await app2.actions.createPost({ id: "e", content: "3" })
	await app2.actions.createPost({ id: "f", content: "4" })

	const [clock2, parents2] = await app2.messageLog.getClock()
	t.is(clock2, 7) // one snapshot, one session, four actions
	t.is(parents2.length, 1)

	t.is((await app2.db.get("posts", "a"))?.content, "1")
	t.is((await app2.db.get("posts", "b"))?.content, "2")
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is((await app2.db.get("posts", "e"))?.content, "3")
	t.is((await app2.db.get("posts", "f"))?.content, "4")

	// snapshot a second time
	const snapshot2 = await createSnapshot(app2)
	const app3 = await Canvas.initialize({ reset: true, snapshot: snapshot2, ...config })

	t.is((await app3.db.get("posts", "a"))?.content, "1")
	t.is((await app3.db.get("posts", "b"))?.content, "2")
	t.is((await app3.db.get("posts", "c"))?.content, "qux")
	t.is(await app3.db.get("posts", "d"), null)
	t.is((await app3.db.get("posts", "e"))?.content, "3")
	t.is((await app3.db.get("posts", "f"))?.content, "4")
	t.is(await app3.db.get("posts", "g"), null)

	const [clock3, parents3] = await app3.messageLog.getClock()
	t.is(clock3, 2) // one snapshot
	t.is(parents2.length, 1)
})
