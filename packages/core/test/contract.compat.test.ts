import test from "ava"
import { ethers } from "ethers"
import { SIWESigner } from "@canvas-js/signer-ethereum"
import { ActionContext, Canvas, ModelAPI, ModelSchema, createClassContract } from "@canvas-js/core"
import { DeriveModelTypes } from "@canvas-js/modeldb"

const models = {
	posts: {
		id: "primary",
		content: "string",
		address: "string",
		did: "string",
		timestamp: "integer",
		isVisible: "boolean",
	},
} satisfies ModelSchema

const actions = {
	async createPost(db: ModelAPI<DeriveModelTypes<typeof models>>, content: string, isVisible: boolean) {
		const { id, did, address, timestamp } = this
		const postId = [did, id].join("/")
		await db.set("posts", { id: postId, content, address, did, isVisible, timestamp })
	},

	async updatePost(db: ModelAPI<DeriveModelTypes<typeof models>>, postId: string, content: string, isVisible: boolean) {
		const { did } = this
		const post = await db.get("posts", postId)
		if (post?.did !== did) throw new Error("can only update own posts")
		await db.update("posts", { id: postId, content, isVisible })
	},

	async deletePost(db: ModelAPI<DeriveModelTypes<typeof models>>, key: string) {
		const { did } = this
		if (!key.startsWith(did + "/")) {
			throw new Error("unauthorized")
		}
		await db.delete("posts", key)
	},
} satisfies Record<string, (this: ActionContext<DeriveModelTypes<typeof models>>, db: ModelAPI<DeriveModelTypes<typeof models>>, ...args: any[]) => any>

test("create a valid class contract from actions and models", async (t) => {
	const BlogContract = createClassContract("BlogContract", models, actions)

	const wallet = ethers.Wallet.createRandom()
	const signer = new SIWESigner({ signer: wallet })

	const app = await Canvas.initialize({
		topic: "com.example.compat-test",
		contract: BlogContract,
		reset: true,
		signers: [signer],
	})

	t.teardown(() => app.stop())

	t.is(BlogContract.name, "BlogContract")
	t.deepEqual(BlogContract.models, models)

	const { id, message } = await app.actions.createPost("hello compatibility", true)

	const postId = [message.payload.did, id].join("/")
	const value = await app.db.get("posts", postId)
	t.is(value?.content, "hello compatibility")
	t.is(value?.isVisible, true)
	t.is(value?.did, `did:pkh:eip155:1:${wallet.address}`)
})
