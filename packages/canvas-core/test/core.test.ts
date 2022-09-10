import test from "ava"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"

import { Core, ApplicationError, SqliteStore, compileSpec } from "@canvas-js/core"
import { ActionArgument, getActionSignatureData, getSessionSignatureData, SessionPayload } from "@canvas-js/interfaces"

const quickJS = await getQuickJS()

const signer = ethers.Wallet.createRandom()
const signerAddress = signer.address.toLowerCase()

const { spec, name } = await compileSpec({
	models: {
		threads: { title: "string", link: "string", creator: "string" },
		thread_votes: {
			thread_id: "string",
			creator: "string",
			value: "integer",
		},
	},
	actions: {
		newThread(title, link) {
			if (typeof title === "string" && typeof link === "string") {
				this.db.threads.set(this.hash, { creator: this.from, title, link })
			}
		},
		voteThread(threadId, value) {
			if (typeof threadId !== "string") {
				throw new Error("threadId must be a string")
			} else if (value !== 1 && value !== -1) {
				throw new Error("invalid vote value")
			}

			this.db.thread_votes.set(`${threadId}/${this.from}`, { creator: this.from, thread_id: threadId, value })
		},
	},
})

async function sign(call: string, args: ActionArgument[]) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: name, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session: null, signature: actionSignature }
}

test("Apply signed action", async (t) => {
	const store = new SqliteStore(null)
	const core = await Core.initialize({ name, spec, directory: null, store, quickJS, unchecked: true })

	const action = await sign("newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash } = await core.apply(action)

	t.deepEqual(store.database.prepare("SELECT * FROM threads").all(), [
		{
			id: hash,
			title: "Hacker News",
			creator: signerAddress,
			link: "https://news.ycombinator.com",
			updated_at: action.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply two signed actions", async (t) => {
	const store = new SqliteStore(null)
	const core = await Core.initialize({ name, spec, directory: null, store, quickJS, unchecked: true })

	const newThreadAction = await sign("newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash: newThreadHash } = await core.apply(newThreadAction)

	const voteThreadAction = await sign("voteThread", [newThreadHash, 1])
	await core.apply(voteThreadAction)

	t.deepEqual(store.database.prepare("SELECT * FROM threads").all(), [
		{
			id: newThreadHash,
			title: "Hacker News",
			creator: signerAddress,
			link: "https://news.ycombinator.com",
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	t.pass()

	await core.close()
})

const sessionSigner = ethers.Wallet.createRandom()
const sessionSignerAddress = await sessionSigner.getAddress()

async function signWithSession(call: string, args: ActionArgument[]) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: name, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await sessionSigner._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session: sessionSignerAddress, signature: actionSignature }
}

test("Apply action signed with session key", async (t) => {
	const store = new SqliteStore(null)
	const core = await Core.initialize({ name, spec, directory: null, store, quickJS, unchecked: true })

	const sessionPayload: SessionPayload = {
		from: signerAddress,
		spec: name,
		timestamp: Date.now(),
		address: sessionSignerAddress,
		duration: 60 * 60 * 1000, // 1 hour
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	await core.session({ payload: sessionPayload, signature: sessionSignature })

	const action = await signWithSession("newThread", ["Hacker News", "https://news.ycombinator.com"])

	const { hash } = await core.apply(action)

	t.deepEqual(store.database.prepare("SELECT * FROM threads").all(), [
		{
			id: hash,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signerAddress,
			updated_at: action.payload.timestamp,
		},
	])

	await core.close()
})

test("Apply two actions signed with session keys", async (t) => {
	const store = new SqliteStore(null)
	const core = await Core.initialize({ name, spec, directory: null, store, quickJS, unchecked: true })

	const sessionPayload: SessionPayload = {
		from: signerAddress,
		spec: name,
		timestamp: Date.now(),
		address: sessionSignerAddress,
		duration: 60 * 60 * 1000, // 1 hour
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	await core.session({ payload: sessionPayload, signature: sessionSignature })

	const newThreadAction = await sign("newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash: newThreadHash } = await core.apply(newThreadAction)
	const voteThreadAction = await sign("voteThread", [newThreadHash, 1])
	await core.apply(voteThreadAction)

	t.deepEqual(store.database.prepare("SELECT * FROM threads").all(), [
		{
			creator: signerAddress,
			id: newThreadHash,
			link: "https://news.ycombinator.com",
			title: "Hacker News",
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	t.pass()

	await core.close()
})

test("Apply an action with a missing signature", async (t) => {
	const core = await Core.initialize({ name, spec, directory: null, quickJS, unchecked: true })
	const action = await sign("newThread", ["Example Website", "http://example.com"])
	action.signature = "0x00"
	await t.throwsAsync(core.apply(action), { instanceOf: Error, code: "INVALID_ARGUMENT" })
	await core.close()
})

test("Apply an action signed by wrong address", async (t) => {
	const core = await Core.initialize({ name, spec, directory: null, quickJS, unchecked: true })
	const action = await sign("newThread", ["Example Website", "http://example.com"])
	action.payload.from = sessionSignerAddress
	await t.throwsAsync(core.apply(action), { instanceOf: Error, message: "action signed by wrong address" })
	await core.close()
})

test("Apply an action that throws an error", async (t) => {
	const core = await Core.initialize({ name, spec, directory: null, quickJS, unchecked: true })

	const newThreadAction = await sign("newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash: newThreadHash } = await core.apply(newThreadAction)
	const voteThreadAction = await sign("voteThread", [newThreadHash, 100000])

	await t.throwsAsync(core.apply(voteThreadAction), {
		instanceOf: ApplicationError,
		message: "invalid vote value",
	})

	await core.close()
})
