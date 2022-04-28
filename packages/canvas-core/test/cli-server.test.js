import test from "ava"

import fs from "node:fs"
import fetch from "node-fetch"
import Hash from "ipfs-only-hash"

import { ethers } from "ethers"
import { BrowserCore } from "../lib/index.js"

const spec = fs.readFileSync("../../examples/reddit.canvas.js", "utf-8")
const multihash = await Hash.of(spec)

const signer = new ethers.Wallet("0x111111111111111111111111111111111111")
const from = await signer.getAddress()

test("Apply action directly", async (t) => {
	const core = await BrowserCore.initialize({ spec })
	t.is(core.multihash, multihash)

	const timestamp = Math.round(Date.now() / 1000)
	const payload = JSON.stringify({
		from,
		spec: multihash,
		timestamp,
		call: "thread",
		args: ["0", "title", "http://example.com/"],
	})

	const signature = await signer.signMessage(payload)
	const action = { from, session: null, signature, payload }

	t.deepEqual(
		(
			await fetch("http://localhost:8000/actions", {
				method: "post",
				body: JSON.stringify(action),
				headers: { "Content-Type": "application/json" },
			})
		).statusText,
		"OK"
	)

	t.deepEqual(await (await fetch("http://localhost:8000/latest")).json(), [
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
})

test("Apply action using a session key", async (t) => {
	const timestamp = Math.round(Date.now() / 1000)
	const session_wallet = new ethers.Wallet.createRandom()
	const session_public_key = session_wallet.address
	const session_duration = 24 * 60 * 60 // 24 hours = 86400

	const payload = JSON.stringify({
		from,
		spec: multihash,
		timestamp,
		session_public_key,
		session_duration,
	})

	const signature = await signer.signMessage(payload)
	const action = {
		from,
		session: null,
		signature,
		payload,
	}

	t.deepEqual(
		(
			await fetch("http://localhost:8000/sessions", {
				method: "post",
				body: JSON.stringify(action),
				headers: { "Content-Type": "application/json" },
			})
		).statusText,
		"OK"
	)

	const payload2 = JSON.stringify({
		from,
		spec: multihash,
		timestamp: timestamp + 1,
		call: "thread",
		args: ["0", "title", "http://example.com/"],
	})

	const signature2 = await session_wallet.signMessage(payload2)
	const action2 = {
		from,
		session: session_wallet.address,
		signature: signature2,
		payload: payload2,
	}

	t.deepEqual(
		(
			await fetch("http://localhost:8000/actions", {
				method: "post",
				body: JSON.stringify(action2),
				headers: { "Content-Type": "application/json" },
			})
		).statusText,
		"OK"
	)

	t.deepEqual(await (await fetch("http://localhost:8000/latest")).json(), [
		{
			id: "0",
			timestamp: timestamp + 1,
			title: "title",
			link: "http://example.com/",
			creator: from,
			score: null,
			voters: null,
		},
	])
})
