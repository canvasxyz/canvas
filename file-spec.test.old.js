import test from "ava"

import fs from "node:fs"

import { ethers } from "ethers"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/interfaces"

import { getQuickJS } from "quickjs-emscripten"
import { Core } from "../lib/index.js"

import { createOfflineMemoryIPFS } from "./utils.js"

const spec = fs.readFileSync("./example.canvas.js", "utf-8")

const ipfs = await createOfflineMemoryIPFS()
const cid = await ipfs.add(spec).then(({ cid }) => cid.toString())

const quickJS = await getQuickJS()

const signer = new ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

test("Apply signed action", async (t) => {
	const core = await Core.initialize({ directory: null, cid, ipfs, quickJS })

	const timestamp = Date.now()
	const actionPayload = {
		from: signerAddress,
		spec: cid,
		call: "set",
		args: ["foo", "bar"],
		timestamp: timestamp,
	}

	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	const action = { payload: actionPayload, session: null, signature: actionSignature }

	const { hash } = await core.apply(action)
	t.is(hash, ethers.utils.sha256(actionSignature))

	const result = core.getView("get", ["foo"])

	t.deepEqual(result, { from: signerAddress, value: "bar" })

	await core.close()
})

// test("Apply session-signed action", async (t) => {
// 	const core = await CanvasCore.initialize({ directory: null, ipfs, cid, quickJS })

// 	const session_wallet = new ethers.Wallet.createRandom()
// 	const session_public_key = session_wallet.address
// 	const session_duration = 24 * 60 * 60 // 24 hours = 86400

// 	const sessionPayload = {
// 		from: signerAddress,
// 		spec: cid,
// 		timestamp: +Date.now(),
// 		session_public_key,
// 		session_duration,
// 	}

// 	const sessionSignatureData = getSessionSignatureData(sessionPayload)
// 	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
// 	const session = { payload: sessionPayload, signature: sessionSignature }

// 	await core.session(session)

// 	const actionTimestamp = +Date.now()
// 	const actionPayload = {
// 		from: signerAddress,
// 		spec: cid,
// 		call: "thread",
// 		args: ["0", "title", "http://example.com/"],
// 		timestamp: actionTimestamp,
// 	}

// 	const actionSignatureData = getActionSignatureData(actionPayload)
// 	const actionSignature = await session_wallet._signTypedData(...actionSignatureData)
// 	const action = { payload: actionPayload, session: session_wallet.address, signature: actionSignature }

// 	const { hash } = await core.apply(action)
// 	t.is(hash, ethers.utils.sha256(actionSignature))

// 	t.deepEqual(core.getRoute("/latest"), [
// 		{
// 			id: "0",
// 			timestamp: actionTimestamp,
// 			title: "title",
// 			link: "http://example.com/",
// 			creator: signerAddress,
// 			score: null,
// 			voters: null,
// 		},
// 	])

// 	await core.close()
// })
