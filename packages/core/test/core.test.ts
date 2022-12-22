import test from "ava"

import { ethers } from "ethers"

import { Core, ApplicationError, compileSpec } from "@canvas-js/core"
import { Action, ActionArgument, ActionPayload, SessionPayload } from "@canvas-js/interfaces"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/verifiers"

const signer = ethers.Wallet.createRandom()
const signerAddress = signer.address.toLowerCase()

const { spec, uri } = await compileSpec({
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

async function sign(call: string, args: Record<string, ActionArgument>): Promise<Action> {
	const timestamp = Date.now()
	const actionPayload: ActionPayload = {
		from: signerAddress,
		spec: uri,
		call,
		args,
		timestamp,
		blockhash: null,
		chain: "eth",
		chainId: 1,
	}
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { type: "action", payload: actionPayload, session: null, signature: actionSignature }
}

test("Apply signed action", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true, offline: true })

	const action = await sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash } = await core.applyAction(action)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
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
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true })

	const newThreadAction = await sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: newThreadHash } = await core.applyAction(newThreadAction)

	const voteThreadAction = await sign("voteThread", { threadId: newThreadHash, value: 1 })
	await core.applyAction(voteThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
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

const sessionWallet = ethers.Wallet.createRandom()
const sessionWalletAddress = await sessionWallet.getAddress()

async function signWithSession(call: string, args: Record<string, ActionArgument>): Promise<Action> {
	const timestamp = Date.now()
	const actionPayload: ActionPayload = {
		from: signerAddress,
		spec: uri,
		call,
		args,
		timestamp,
		blockhash: null,
		chain: "eth",
		chainId: 1,
	}
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await sessionWallet._signTypedData(...actionSignatureData)
	return { type: "action", payload: actionPayload, session: sessionWalletAddress, signature: actionSignature }
}

test("Apply action signed with session key", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true })

	const sessionPayload: SessionPayload = {
		from: signerAddress,
		spec: uri,
		timestamp: Date.now(),
		address: sessionWalletAddress,
		duration: 60 * 60 * 1000, // 1 hour
		chain: "eth",
		chainId: 1,
		blockhash: null,
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	await core.applySession({ type: "session", payload: sessionPayload, signature: sessionSignature })

	const action = await signWithSession("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })

	const { hash } = await core.applyAction(action)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
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
	const core = await Core.initialize({ directory: null, uri, spec, unchecked: true })

	const sessionPayload: SessionPayload = {
		from: signerAddress,
		spec: uri,
		timestamp: Date.now(),
		address: sessionWalletAddress,
		duration: 60 * 60 * 1000, // 1 hour
		chain: "eth",
		chainId: 1,
		blockhash: null,
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	await core.applySession({ type: "session", payload: sessionPayload, signature: sessionSignature })

	const newThreadAction = await sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.applyAction(newThreadAction)
	const voteThreadAction = await sign("voteThread", { threadId, value: 1 })
	await core.applyAction(voteThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			creator: signerAddress,
			id: threadId,
			link: "https://news.ycombinator.com",
			title: "Hacker News",
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	t.pass()

	await core.close()
})

test("Apply an action with a missing signature", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true })
	const action = await sign("newThread", { title: "Example Website", link: "http://example.com" })
	action.signature = "0x00"
	await t.throwsAsync(core.applyAction(action), { instanceOf: Error, code: "INVALID_ARGUMENT" })
	await core.close()
})

test("Apply an action signed by wrong address", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true })
	const action = await sign("newThread", { title: "Example Website", link: "http://example.com" })
	action.payload.from = sessionWalletAddress
	await t.throwsAsync(core.applyAction(action), { instanceOf: Error, message: "action signed by wrong address" })
	await core.close()
})

test("Apply an action that throws an error", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true })

	const newThreadAction = await sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.applyAction(newThreadAction)
	const voteThreadAction = await sign("voteThread", { threadId, value: 100000 })

	await t.throwsAsync(core.applyAction(voteThreadAction), {
		instanceOf: ApplicationError,
		message: "invalid vote value",
	})

	await core.close()
})
