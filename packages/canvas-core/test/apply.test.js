import test from "ava"

import fs from "node:fs"

import { ethers } from "ethers"
import randomAccessMemory from "random-access-memory"
import { BrowserCore } from "../lib/core-browser.js"

const spec = fs.readFileSync("../../examples/reddit.canvas.js", "utf-8")

const signer = new ethers.Wallet("0x111111111111111111111111111111111111")
const from = await signer.getAddress()

test("Apply action", async (t) => {
	const multihash = "QmMultihash"
	const core = await BrowserCore.initialize(multihash, spec, { storage: randomAccessMemory })

	const timestamp = Date.now()

	const payload = JSON.stringify({
		spec: multihash,
		call: "thread",
		args: ["0", "title", "http://example.com/"],
		from,
		timestamp,
	})

	const signature = await signer.signMessage(payload)
	const action = { from, session: null, chainId: "", signature, payload }

	await core.apply(action)

	t.deepEqual(core.getRoute("/latest"), [
		{
			id: "0",
			timestamp,
			title: "title",
			link: "http://example.com/",
			creator: from,
			score: null,
			voters: null,
		},
	])

	await new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve()
		}, 100)
	})

	await core.close()
})
