import test from "ava"

import { ethers } from "ethers"
import { Core, ApplicationError, compileSpec } from "@canvas-js/core"

import { TestSessionSigner, TestSigner } from "./utils.js"
import { CustomAction } from "@canvas-js/interfaces"

const { spec, app, appName } = await compileSpec({
	name: "Test App",
	models: {
		threads: { id: "string", title: "string", link: "string", creator: "string", updated_at: "datetime" },
		thread_votes: {
			id: "string",
			thread_id: "string",
			creator: "string",
			value: "integer",
			updated_at: "datetime",
		},
	},
	actions: {
		newThread({ title, link }, { db, hash, from }) {
			if (typeof title === "string" && typeof link === "string") {
				db.threads.set(hash, { creator: from, title, link })
			}
		},
		voteThread({ threadId, value }, { db, from }) {
			if (typeof threadId !== "string") {
				throw new Error("threadId must be a string")
			} else if (value !== 1 && value !== -1) {
				throw new Error("invalid vote value")
			}

			db.thread_votes.set(`${threadId}/${from}`, { creator: from, thread_id: threadId, value })
		},
	},
})

const signer = new TestSigner(app, appName)
const sessionSigner = new TestSessionSigner(signer)

test("Apply signed action", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })

	const action = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash } = await core.applyAction(action)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: hash,
			title: "Hacker News",
			creator: signer.wallet.address,
			link: "https://news.ycombinator.com",
			updated_at: action.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply two signed actions", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })

	const newThreadAction = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: newThreadHash } = await core.applyAction(newThreadAction)

	const voteThreadAction = await signer.sign("voteThread", { threadId: newThreadHash, value: 1 })
	await core.applyAction(voteThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: newThreadHash,
			title: "Hacker News",
			creator: signer.wallet.address,
			link: "https://news.ycombinator.com",
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply action signed with session key", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })
	const session = await sessionSigner.session()
	await core.applySession(session)

	const action = await sessionSigner.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash } = await core.applyAction(action)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: hash,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signer.wallet.address,
			updated_at: action.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply two actions signed with session keys", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })

	const session = await sessionSigner.session()
	await core.applySession(session)

	const newThreadAction = await sessionSigner.sign("newThread", {
		title: "Hacker News",
		link: "https://news.ycombinator.com",
	})
	const { hash: threadId } = await core.applyAction(newThreadAction)
	const voteThreadAction = await sessionSigner.sign("voteThread", { threadId, value: 1 })
	await core.applyAction(voteThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: threadId,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signer.wallet.address,
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply an action with a missing signature", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })
	const action = await signer.sign("newThread", { title: "Example Website", link: "http://example.com" })
	action.signature = "0x00"
	await t.throwsAsync(core.applyAction(action), { instanceOf: Error, code: "INVALID_ARGUMENT" })
	await core.close()
})

test("Apply an action signed by wrong address", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })
	const action = await signer.sign("newThread", { title: "Example Website", link: "http://example.com" })
	const { address } = ethers.Wallet.createRandom()
	action.payload.from = address
	await t.throwsAsync(core.applyAction(action), { instanceOf: Error, message: /^Invalid action signature/ })
	await core.close()
})

test("Apply an action that throws an error", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })

	const newThreadAction = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.applyAction(newThreadAction)
	const voteThreadAction = await signer.sign("voteThread", { threadId, value: 100000 })

	await t.throwsAsync(core.applyAction(voteThreadAction), {
		instanceOf: ApplicationError,
		message: "invalid vote value",
	})

	await core.close()
})

test("Create an in-memory Core with a file:// URI", async (t) => {
	const uri = "file:///dev/null"
	const signer = new TestSigner(uri, appName)
	const core = await Core.initialize({ uri, spec, directory: null, libp2p: null, unchecked: true })
	const newThreadAction = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.applyAction(newThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: threadId,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signer.wallet.address,
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply a custom action with a valid payload", async (t) => {
	const spec = `
	export const models = {
		things: {
			id: "string",
			alpha: "string",
			beta: "string",
			updated_at: "datetime"
		},
	};
	export const actions = {
		doThing: customAction({
			"$id": "https://example.com/string",
			"$schema": "https://json-schema.org/draft/2020-12/schema",
			"type": "object",
			"properties": {
				"alpha": { "type": "string" },
				"beta": { "type": "string" }
			}
		}, ({alpha, beta}, {db, hash}) => {
			db.things.set(hash, {alpha, beta });
		})
	};
	export const routes = {
		"/things": () => "select * from things"
	};
	`
	const cid = "1234567"
	const uri = `ipfs://${cid}`
	const core = await Core.initialize({ uri, spec, directory: null, libp2p: null, unchecked: true })
	const newCustomAction: CustomAction = {
		type: "customAction",
		app: uri,
		name: "doThing",
		payload: {
			alpha: "zero",
			beta: "one",
		},
	}
	await core.applyCustomAction(newCustomAction)

	const items = await core.getRoute("/things", {})
	const createdThing = items[0]
	t.deepEqual(createdThing.updated_at, 0)
	t.deepEqual(createdThing.alpha, "zero")
	t.deepEqual(createdThing.beta, "one")
	t.pass()
})
