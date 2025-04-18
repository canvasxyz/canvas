import test, { ExecutionContext } from "ava"
import { nanoid } from "nanoid"
import PQueue from "p-queue"

import { SIWESigner } from "@canvas-js/signer-ethereum"
import { Actions, Canvas, ModelSchema } from "@canvas-js/core"

const models = {
	posts: { id: "primary", content: "string" },
} satisfies ModelSchema

const actions = {
	async createPost(db, content: string) {
		await db.set("posts", { id: this.id, content })
	},

	async updatePost(db, postId: string, content: string) {
		await db.update("posts", { id: postId, content })
	},

	async deletePost(db, postId: string) {
		await db.delete("posts", postId)
	},

	async getPostContent(db, postId: string) {
		const post = await db.get("posts", postId)
		return post?.content ?? null
	},
} satisfies Actions<typeof models>

const init = async (t: ExecutionContext<unknown>) => {
	const signer = new SIWESigner({ burner: true })
	const app = await Canvas.initialize({
		contract: { models, actions },
		topic: "com.example.app",
		signers: [signer],
	})

	t.teardown(() => app.stop())
	return app
}

test("retrieve last-write-wins value", async (t) => {
	const app1 = await init(t)
	const app2 = await init(t)

	const queue = new PQueue({ concurrency: 10 })

	for (let i = 0; i < 50; i++) {
		queue.add(async () => {
			const { id: postId } = await app1.actions.createPost(nanoid())

			// sync app1 -> app2
			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

			const content = nanoid()
			const { id: updateId } = await app1.actions.updatePost(postId, content)
			const { id: deleteId } = await app2.actions.deletePost(postId)

			// sync app2 -> app1
			await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))

			// sync app1 -> app2
			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

			const { result: content1 } = await app1.actions.getPostContent(postId)
			const { result: content2 } = await app2.actions.getPostContent(postId)

			if (updateId > deleteId) {
				t.is(content1, content)
				t.is(content2, content)
				t.deepEqual(await app1.db.get("posts", postId), { id: postId, content })
				t.deepEqual(await app2.db.get("posts", postId), { id: postId, content })
			} else {
				t.is(content1, null)
				t.is(content2, null)
				t.deepEqual(await app1.db.get("posts", postId), null)
				t.deepEqual(await app2.db.get("posts", postId), null)
			}
		})
	}

	await queue.onIdle()
})
