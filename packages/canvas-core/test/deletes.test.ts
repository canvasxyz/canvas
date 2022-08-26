import test from "ava"

import fs from "node:fs"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"

import { ActionArgument, getActionSignatureData } from "@canvas-js/interfaces"
import { Core, CoreConfig } from "@canvas-js/core"

const quickJS = await getQuickJS()

const spec = fs.readFileSync("./test/example.canvas.js", "utf-8")
const specName = "example.canvas.js"

const signer = ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

async function sign(signer: ethers.Wallet, session: string | null, call: string, args: ActionArgument[]) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: specName, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session, signature: actionSignature }
}

const coreConfig: CoreConfig = {
	name: specName,
	databaseURI: null,
	spec,
	quickJS,
	unchecked: true,
}

test("Test setting and then deleting a record", async (t) => {
	const core = await Core.initialize(coreConfig)
	const { hash: threadId } = await sign(signer, null, "newThread", [
		"Hacker News",
		"https://news.ycombinator.com",
	]).then((action) => core.apply(action))

	await core.getRoute("/latest", {}).then(({ length }) => t.is(length, 1))

	await sign(signer, null, "deleteThread", [threadId]).then((action) => core.apply(action))

	await core.getRoute("/latest", {}).then(({ length }) => t.is(length, 0))

	await core.close()
})
