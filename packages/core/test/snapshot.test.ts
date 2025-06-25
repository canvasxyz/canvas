import test from "ava"

import { Canvas, hashSnapshot, ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

test("snapshot persists data across apps", async (t) => {
	class MyApp extends Contract<typeof MyApp.models> {
		static baseTopic = "my-app.example.com"
		static models = {
			posts: {
				id: "primary",
				content: "string",
			},
		} satisfies ModelSchema

		async createPost({ id, content }: { id: string; content: string }) {
			await this.db.set("posts", { id, content })
		}

		async deletePost({ id }: { id: string }) {
			await this.db.delete("posts", id)
		}
	}

	const app = await Canvas.initialize({ contract: MyApp })

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
	const snapshot = await app.createSnapshot()
	await app.stop()

	const app2 = await Canvas.initialize({
		contract: MyApp,
		snapshot,
		reset: true,
	})

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
	t.is(clock2, 6) // one snapshot, one session, four actions
	t.is(parents2.length, 1)

	t.is((await app2.db.get("posts", "a"))?.content, "1")
	t.is((await app2.db.get("posts", "b"))?.content, "2")
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is((await app2.db.get("posts", "e"))?.content, "3")
	t.is((await app2.db.get("posts", "f"))?.content, "4")

	// snapshot a second time
	const snapshot2 = await app2.createSnapshot()
	const app3 = await Canvas.initialize({
		contract: MyApp,
		snapshot: snapshot2,
		reset: true,
	})

	t.is((await app3.db.get("posts", "a"))?.content, "1")
	t.is((await app3.db.get("posts", "b"))?.content, "2")
	t.is((await app3.db.get("posts", "c"))?.content, "qux")
	t.is(await app3.db.get("posts", "d"), null)
	t.is((await app3.db.get("posts", "e"))?.content, "3")
	t.is((await app3.db.get("posts", "f"))?.content, "4")
	t.is(await app3.db.get("posts", "g"), null)

	const [clock3] = await app3.messageLog.getClock()
	t.is(clock3, 1) // one snapshot
	t.is(parents2.length, 1)
})
