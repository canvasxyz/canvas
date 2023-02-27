import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import assert from "node:assert"

import test from "ava"

import { nanoid } from "nanoid"

import { Message } from "@canvas-js/interfaces"
import { Core } from "@canvas-js/core"
import * as constants from "@canvas-js/core/constants"

import { fromHex, stringify, toHex } from "@canvas-js/core/utils"
import { getMessageKey } from "@canvas-js/core/sync"

import { TestSigner, compileSpec } from "./utils.js"

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
	const { hash: sourceActionHash } = await core.apply(sourceAction)
	const createAction = await signer.sign("create", { content: "lorem ipsum" })
	const { hash: createActionHash } = await core.apply(createAction)
	const voteAction = await signer.sign("vote", { post_id: createActionHash, value: 1 })
	const { hash: voteActionHash } = await core.apply(voteAction)
	const voteSourceAction = await signer.sign("vote", { post_id: sourceActionHash, value: -1 })
	const { hash: voteSourceActionHash } = await core.apply(voteSourceAction)

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

	const entries: [Uint8Array, Message][] = []
	for await (const entry of core.messageStore.getMessageStream()) {
		entries.push(entry)
	}

	t.deepEqual(entries, [
		[Buffer.from(fromHex(sourceActionHash)), sourceAction],
		[Buffer.from(fromHex(createActionHash)), createAction],
		[Buffer.from(fromHex(voteActionHash)), voteAction],
		[Buffer.from(fromHex(voteSourceActionHash)), voteSourceAction],
	])

	await core.close()
})

test("Build missing MST index on core startup", async (t) => {
	const directory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)

	type Entry = { key: Uint8Array; value: Uint8Array }
	const getEntry = (hash: string, message: Message): Entry => {
		const hashBuffer = fromHex(hash)
		return { key: getMessageKey(hashBuffer, message), value: hashBuffer }
	}

	const mstEntries: Record<string, Entry[]> = {}

	try {
		// apply a mix of source and direct actions
		await t.notThrowsAsync(async () => {
			const core = await Core.initialize({
				directory,
				uri: MessageBoardWithVotes.app,
				spec: MessageBoardWithVotes.spec,
				libp2p: null,
				unchecked: true,
			})

			const sourceAction = await sourceSigner.sign("createPost", { content: "hello world" })
			const { hash: sourceActionHash } = await core.apply(sourceAction)
			const createAction = await signer.sign("create", { content: "lorem ipsum" })
			const { hash: createActionHash } = await core.apply(createAction)
			const voteAction = await signer.sign("vote", { post_id: createActionHash, value: 1 })
			const { hash: voteActionHash } = await core.apply(voteAction)
			const voteSourceAction = await signer.sign("vote", { post_id: sourceActionHash, value: -1 })
			const { hash: voteSourceActionHash } = await core.apply(voteSourceAction)

			await core.close()

			mstEntries[MessageBoard.app] = [getEntry(sourceActionHash, sourceAction)]
			mstEntries[MessageBoardWithVotes.app] = [
				getEntry(createActionHash, createAction),
				getEntry(voteActionHash, voteAction),
				getEntry(voteSourceActionHash, voteSourceAction),
			]
		})

		const mstPath = path.resolve(directory, constants.MST_DIRECTORY_NAME)
		t.true(fs.existsSync(mstPath))
		t.true(fs.statSync(mstPath).isDirectory())

		// delete the MST directory
		fs.rmSync(mstPath, { recursive: true })

		// open the core again
		const core = await Core.initialize({
			directory,
			uri: MessageBoardWithVotes.app,
			spec: MessageBoardWithVotes.spec,
			libp2p: null,
			unchecked: true,
		})

		t.true(fs.existsSync(mstPath))
		t.true(fs.statSync(mstPath).isDirectory())

		try {
			for (const [dbi, entries] of Object.entries(mstEntries)) {
				await core.messageStore.read(
					async (txn) => {
						for (const { key, value } of entries) {
							const { id } = await txn.getNode(0, key)
							t.deepEqual(id, value)
						}
					},
					{ dbi }
				)
			}
		} finally {
			await core.close()
		}
	} finally {
		fs.rmSync(directory, { recursive: true })
	}
})
