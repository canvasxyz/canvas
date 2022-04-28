import test from "ava"

import fs from "node:fs"

import { ethers } from "ethers"
import { BrowserCore } from "../lib/index.js"

const spec = fs.readFileSync("../../examples/reddit.canvas.js", "utf-8")

const signer = new ethers.Wallet("0x111111111111111111111111111111111111")
const from = await signer.getAddress()

test("Apply action", async (t) => {
	const core = await BrowserCore.initialize({ spec })

	const timestamp = Math.round(Date.now() / 1000)

	const payload = JSON.stringify({
		spec: core.multihash,
		call: "thread",
		args: ["0", "title", "http://example.com/"],
		from,
		timestamp,
	})

	const signature = await signer.signMessage(payload)
	const action = { from, session: null, signature, payload }

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
