import test from "ava"

import fs from "node:fs"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"
import Hash from "ipfs-only-hash"

import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/interfaces"
import { Core, ApplicationError } from "../lib/index.js"

const spec = fs.readFileSync("./test/example.canvas.js", "utf-8")
const multihash = await Hash.of(spec)

const quickJS = await getQuickJS()

const signer = new ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

const sessionSigner = new ethers.Wallet.createRandom()
const sessionSignerAddress = await sessionSigner.getAddress()

async function sign(signer, session, call, args) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: multihash, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session, signature: actionSignature }
}

test("Apply signed action", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })

	const action = await sign(signer, null, "newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash } = await core.apply(action)
	t.is(hash, ethers.utils.sha256(action.signature))

	const result = core.getRoute("/latest")
	t.deepEqual(result, [
		{
			creator: signerAddress,
			id: hash,
			link: "https://news.ycombinator.com",
			title: "Hacker News",
			updated_at: action.payload.timestamp,
			score: null,
			voters: null,
		},
	])

	await core.close()
})

test("Apply two signed actions", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })

	const newThreadAction = await sign(signer, null, "newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash: newThreadHash } = await core.apply(newThreadAction)
	const voteThreadAction = await sign(signer, null, "voteThread", [newThreadHash, 1])
	await core.apply(voteThreadAction)

	const result = core.getRoute("/latest", [{}])

	t.deepEqual(result, [
		{
			creator: signerAddress,
			id: newThreadHash,
			link: "https://news.ycombinator.com",
			title: "Hacker News",
			updated_at: newThreadAction.payload.timestamp,
			voters: signerAddress,
			score: result[0].score,
		},
	])

	t.pass()

	await core.close()
})

test("Apply action signed with session key", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })

	const sessionPayload = {
		from: signerAddress,
		spec: multihash,
		timestamp: Date.now(),
		session_public_key: sessionSignerAddress,
		session_duration: 60 * 60 * 1000, // 1 hour
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	await core.session({ payload: sessionPayload, signature: sessionSignature })

	const action = await sign(sessionSigner, sessionSignerAddress, "newThread", [
		"Hacker News",
		"https://news.ycombinator.com",
	])

	const { hash } = await core.apply(action)
	t.is(hash, ethers.utils.sha256(action.signature))

	const result = core.getRoute("/latest")
	t.deepEqual(result, [
		{
			creator: signerAddress,
			id: hash,
			link: "https://news.ycombinator.com",
			title: "Hacker News",
			updated_at: action.payload.timestamp,
			score: null,
			voters: null,
		},
	])

	await core.close()
})

test("Apply two actions signed with session keys", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })

	const sessionPayload = {
		from: signerAddress,
		spec: multihash,
		timestamp: Date.now(),
		session_public_key: sessionSignerAddress,
		session_duration: 60 * 60 * 1000, // 1 hour
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	await core.session({ payload: sessionPayload, signature: sessionSignature })

	const newThreadAction = await sign(signer, null, "newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash: newThreadHash } = await core.apply(newThreadAction)
	const voteThreadAction = await sign(signer, null, "voteThread", [newThreadHash, 1])
	await core.apply(voteThreadAction)

	const result = core.getRoute("/latest", [{}])

	t.deepEqual(result, [
		{
			creator: signerAddress,
			id: newThreadHash,
			link: "https://news.ycombinator.com",
			title: "Hacker News",
			updated_at: newThreadAction.payload.timestamp,
			voters: signerAddress,
			score: result[0].score,
		},
	])

	t.pass()

	await core.close()
})

test("Apply an action with a missing signature", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })
	const action = await sign(sessionSigner, sessionSignerAddress, "newThread", ["Example Website", "http://example.com"])
	action.session = null
	action.signature = "0x00"
	await t.throwsAsync(core.apply(action), { instanceOf: Error, code: "INVALID_ARGUMENT" })
	await core.close()
})

test("Apply an action signed by wrong address", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })
	const action = await sign(sessionSigner, null, "newThread", ["Example Website", "http://example.com"])
	await t.throwsAsync(core.apply(action), { instanceOf: Error, message: "action signed by wrong address" })
	await core.close()
})

test("Apply an action that throws an error", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })

	const newThreadAction = await sign(signer, null, "newThread", ["Hacker News", "https://news.ycombinator.com"])
	const { hash: newThreadHash } = await core.apply(newThreadAction)
	const voteThreadAction = await sign(signer, null, "voteThread", [newThreadHash, 100000])

	await t.throwsAsync(core.apply(voteThreadAction), {
		instanceOf: ApplicationError,
		message: "invalid vote value",
	})

	await core.close()
})
