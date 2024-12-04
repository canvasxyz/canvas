import test, { ExecutionContext } from "ava"
import { randomUUID } from "crypto"

import { SIWESigner } from "@canvas-js/chain-ethereum"
import { ModelSchema } from "@canvas-js/modeldb"
import { JSONValue } from "@canvas-js/utils"
import { Actions, Canvas, ModelAPI } from "@canvas-js/core"

// inline contract
const models = {
	posts: {
		id: "primary",
		content: "string",
		address: "string",
		did: "string",
		timestamp: "integer",
		isVisible: "boolean",
		metadata: "json",
	},
} satisfies ModelSchema

const models2 = {
	posts: {
		...models.posts,
		// deleted: "boolean",
	},
	comments: {
		id: "primary",
		post: "@posts",
		text: "string",
	},
} satisfies ModelSchema

const actions = {
	async createPost(db: ModelAPI<any>, content: string, isVisible: boolean, metadata: JSONValue) {
		const { id, did, address, timestamp } = this
		const postId = [did, id].join("/")
		await db.set("posts", { id: postId, content, address, did, isVisible, timestamp, metadata })
	},
	async updatePost(db: ModelAPI<any>, postId: string, content: string, isVisible: boolean, metadata: JSONValue) {
		const { id, did, address, timestamp } = this
		const post = await db.get("posts", postId)
		if (post.did !== did) throw new Error("can only update own posts")
		await db.update("posts", { id: postId, content, isVisible, metadata })
	},
	async deletePost(db: ModelAPI<any>, key) {
		const { did } = this
		if (!key.startsWith(did + "/")) {
			throw new Error("unauthorized")
		}
		await db.delete("posts", key)
	},
} satisfies Actions<typeof models>

const actions2 = {
	...(actions as Actions<any>),
	async commentPost(db: ModelAPI<any>, post: string, text: string) {
		const { id, did } = this
		await db.set("comments", { id, post, text })
	},
} satisfies Actions<typeof models2>

test("application data persists", async (t) => {
	const path = "/tmp/canvas_test_" + randomUUID()

	const signer = new SIWESigner()
	const app = await Canvas.initialize({
		path,
		contract: { models, actions },
		topic: "com.example.app",
		reset: true,
		signers: [signer],
	})

	const { id, message } = await app.actions.createPost("hello", true, {})

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const clock = await app.messageLog.getClock()
	t.is(clock[0], 3)

	await app.stop()

	const app2 = await Canvas.initialize({
		path,
		contract: { models, actions },
		topic: "com.example.app",
		reset: false,
		signers: [signer],
	})

	const postId2 = [message.payload.did, id].join("/")
	const value2 = await app2.db.get("posts", postId2)
	t.is(value2?.content, "hello")

	const clock2 = await app2.messageLog.getClock()
	t.is(clock2[0], 3)
})

test("can add a column to an existing app", async (t) => {
	const path = "/tmp/canvas_test_" + randomUUID()

	const signer = new SIWESigner()
	const app = await Canvas.initialize({
		path,
		contract: { models, actions },
		topic: "com.example.app",
		reset: true,
		signers: [signer],
	})

	const { id, message } = await app.actions.createPost("hello", true, {})

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello")

	const clock = await app.messageLog.getClock()
	t.is(clock[0], 3)

	await app.stop()

	const app2 = await Canvas.initialize({
		path,
		contract: { models: models2, actions: actions2 },
		topic: "com.example.app",
		reset: false,
		signers: [signer],
	})

	const postId2 = [message.payload.did, id].join("/")
	const value2 = await app2.db.get("posts", postId2)
	t.is(value2?.content, "hello")

	const clock2 = await app2.messageLog.getClock()
	t.is(clock2[0], 3)
})
