import test from "ava"
import assert from "node:assert"

import { Core, compileSpec } from "@canvas-js/core"

import { TestSigner } from "./utils.js"
import { fromHex, stringify } from "@canvas-js/core/lib/utils.js"

const MessageBoard = await compileSpec({
	name: "Test App",
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
	name: "Test App 2",
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
		[MessageBoard.app]: {
			createPost({ content }, { db, hash, from }) {
				assert(typeof content === "string")
				db.posts.set(hash, { content, from })
			},
		},
	},
})

const signer = new TestSigner(MessageBoardWithVotes.app, MessageBoardWithVotes.appName)
const sourceSigner = new TestSigner(MessageBoard.app, MessageBoard.appName)

test("Apply source actions", async (t) => {
	const core = await Core.initialize({
		uri: MessageBoardWithVotes.app,
		spec: MessageBoardWithVotes.spec,
		directory: null,
		libp2p: null,
		unchecked: true,
	})

	const sourceAction = await sourceSigner.sign("createPost", { content: "hello world" })
	const { hash: sourceActionHash } = await core.applyAction(sourceAction)
	const createAction = await signer.sign("create", { content: "lorem ipsum" })
	const { hash: createActionHash } = await core.applyAction(createAction)
	const voteAction = await signer.sign("vote", { post_id: createActionHash, value: 1 })
	const { hash: voteActionHash } = await core.applyAction(voteAction)
	const voteSourceAction = await signer.sign("vote", { post_id: sourceActionHash, value: -1 })
	const { hash: voteSourceActionHash } = await core.applyAction(voteSourceAction)

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

	t.deepEqual(core.messageStore.database.prepare("SELECT * FROM actions").all(), [
		{
			id: 1,
			hash: fromHex(sourceActionHash),
			signature: sourceAction.signature,
			from_address: sourceSigner.wallet.address,
			session_address: null,
			timestamp: sourceAction.payload.timestamp,
			call: sourceAction.payload.call,
			call_args: stringify(sourceAction.payload.callArgs),
			chain: "ethereum",
			chain_id: "1",
			block: null,
			app: MessageBoard.app,

			app_name: "Test App",
		},
		{
			id: 2,
			hash: fromHex(createActionHash),
			signature: createAction.signature,
			from_address: signer.wallet.address,
			session_address: null,
			timestamp: createAction.payload.timestamp,
			call: createAction.payload.call,
			call_args: stringify(createAction.payload.callArgs),
			chain: "ethereum",
			chain_id: "1",
			block: null,
			app: MessageBoardWithVotes.app,
			app_name: "Test App 2",
		},
		{
			id: 3,
			hash: fromHex(voteActionHash),
			signature: voteAction.signature,
			from_address: signer.wallet.address,
			session_address: null,
			timestamp: voteAction.payload.timestamp,
			call: voteAction.payload.call,
			call_args: stringify(voteAction.payload.callArgs),
			chain: "ethereum",
			chain_id: "1",
			block: null,
			app: MessageBoardWithVotes.app,
			app_name: "Test App 2",
		},
		{
			id: 4,
			hash: fromHex(voteSourceActionHash),
			signature: voteSourceAction.signature,
			from_address: signer.wallet.address,
			session_address: null,
			timestamp: voteSourceAction.payload.timestamp,
			call: voteSourceAction.payload.call,
			call_args: stringify(voteSourceAction.payload.callArgs),
			chain: "ethereum",
			chain_id: "1",
			block: null,
			app: MessageBoardWithVotes.app,
			app_name: "Test App 2",
		},
	])

	await core.close()
})
