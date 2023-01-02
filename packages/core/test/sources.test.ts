import test from "ava"
import assert from "node:assert"

import { Core, ApplicationError, compileSpec } from "@canvas-js/core"

import { TestSigner } from "./utils.js"

const MessageBoard = await compileSpec({
	models: {
		posts: { id: "string", content: "string", from: "string", updated_at: "datetime" },
	},
	actions: {
		createPost({ content }, { db, hash, from }) {
			assert(typeof content === "string")
			db.posts.set(hash, { content, from })
		},
	},
})

const MessageBoardWithVotes = await compileSpec({
	models: {
		posts: { id: "string", content: "string", from: "string", updated_at: "datetime" },
		votes: {
			id: "string",
			value: "integer",
			post_id: "string",
			updated_at: "datetime",
		},
	},
	actions: {
		create({ content }, { db, hash, from }) {
			assert(typeof content === "string")
			db.posts.set(hash, { content, from })
		},
		vote({ post_id, value }, { db, from }) {
			assert(value === 1 || value === 0 || value === -1)
			assert(typeof post_id === "string")
			db.votes.set(`${post_id}/${from}`, { post_id, value })
		},
	},
	sources: {
		[MessageBoard.uri]: {
			createPost({ content }, { db, hash, from }) {
				assert(typeof content === "string")
				db.posts.set(hash, { content, from })
			},
		},
	},
})

const signer = new TestSigner(MessageBoardWithVotes.uri)
const sourceSigner = new TestSigner(MessageBoard.uri)

test("Apply source actions", async (t) => {
	const core = await Core.initialize({
		uri: MessageBoardWithVotes.uri,
		spec: MessageBoardWithVotes.spec,
		directory: null,
		unchecked: true,
		offline: true,
	})

	const sourceAction = await sourceSigner.sign("createPost", { content: "hello world" })
	const { hash: sourceActionHash } = await core.applyAction(sourceAction)
	const createAction = await signer.sign("create", { content: "lorem ipsum" })
	const { hash: createActionHash } = await core.applyAction(createAction)
	const voteAction = await signer.sign("vote", { post_id: createActionHash, value: 1 })
	const {} = await core.applyAction(voteAction)
	const voteSourceAction = await signer.sign("vote", { post_id: sourceActionHash, value: -1 })
	const {} = await core.applyAction(voteSourceAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM posts").all(), [
		{
			id: sourceActionHash,
			content: "hello world",
			from: sourceSigner.wallet.address,
			updated_at: sourceAction.payload.timestamp,
		},
		{
			id: createActionHash,
			content: "lorem ipsum",
			from: signer.wallet.address,
			updated_at: createAction.payload.timestamp,
		},
	])

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM votes").all(), [
		{
			id: `${createActionHash}/${signer.wallet.address}`,
			post_id: createActionHash,
			value: 1,
			updated_at: voteAction.payload.timestamp,
		},
		{
			id: `${sourceActionHash}/${signer.wallet.address}`,
			post_id: sourceActionHash,
			value: -1,
			updated_at: voteSourceAction.payload.timestamp,
		},
	])

	await core.close()
})
