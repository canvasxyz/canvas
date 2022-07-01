import test from "ava"

import fs from "node:fs"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"
import Hash from "ipfs-only-hash"

import { getActionSignatureData } from "@canvas-js/interfaces"
import { Core } from "../lib/index.js"

const spec = fs.readFileSync("./test/example.canvas.js", "utf-8")
const multihash = await Hash.of(spec)

const quickJS = await getQuickJS()

const signer = new ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

async function sign(signer, session, call, args) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: multihash, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session, signature: actionSignature }
}

test("Test setting and then deleting a record", async (t) => {
	const core = await Core.initialize({ name: multihash, directory: null, spec, quickJS })
	const { hash: threadId } = await sign(signer, null, "newThread", [
		"Hacker News",
		"https://news.ycombinator.com",
	]).then((action) => core.apply(action))

	t.is(core.getRoute("/latest", {}).length, 1)

	await sign(signer, null, "deleteThread", [threadId]).then((action) => core.apply(action))

	t.is(core.getRoute("/latest", {}).length, 0)

	await core.close()
})
