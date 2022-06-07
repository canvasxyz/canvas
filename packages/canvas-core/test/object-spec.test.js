import test from "ava"

import { ethers } from "ethers"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/interfaces"
import { BrowserCore } from "../lib/index.js"

const signer = new ethers.Wallet.createRandom()
const signerAddress = await signer.getAddress()

const spec = {
	models: {
		threads: {
			title: "string",
			link: "string",
			creator: "string",
		},
		threadVotes: {
			threadId: "string",
			creator: "string",
			value: "integer",
		},
	},
	routes: {
		"/latest": `SELECT
    threads.*,
    SUM(
        1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.timestamp) *
        CAST(threadVotes.value as INT)
    ) AS score,
    group_concat(threadVotes.creator) as voters
FROM threads
    LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
GROUP BY threads.id
ORDER BY threads.timestamp DESC
LIMIT 30`,
		"/top": `SELECT
threads.*,
SUM(
    1 / (cast(strftime('%s','now') as float) * 1000 - threadVotes.timestamp) *
    CAST(threadVotes.value as INT)
) AS score,
group_concat(threadVotes.creator) as voters
FROM threads
LEFT JOIN threadVotes ON threads.id = threadVotes.threadId
GROUP BY threads.id
ORDER BY score DESC
LIMIT 30`,
	},
	actions: {
		thread(id, title, link) {
			this.db.threads.set(id, { creator: this.from, title, link })
		},
		voteThread(threadId, value) {
			if (value !== 1 && value !== -1) return false
			this.db.threadVotes.set(id, { creator: this.from, threadId, value })
		},
	},
}

test("Apply signed action", async (t) => {
	const core = await BrowserCore.initialize({ spec })

	const timestamp = Math.round(Date.now() / 1000)
	const actionPayload = {
		from: signerAddress,
		spec: core.multihash,
		call: "thread",
		args: ["0", "title", "http://example.com/"],
		timestamp: timestamp,
	}

	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	const action = { payload: actionPayload, session: null, signature: actionSignature }

	const { hash } = await core.apply(action)
	t.is(hash, ethers.utils.sha256(actionSignature))

	t.deepEqual(core.getRoute("/latest"), [
		{
			id: "0",
			timestamp,
			title: "title",
			link: "http://example.com/",
			creator: signerAddress,
			score: null,
			voters: null,
		},
	])

	await core.close()
})

test("Apply session-signed action", async (t) => {
	const core = await BrowserCore.initialize({ spec })

	const session_wallet = new ethers.Wallet.createRandom()
	const session_public_key = session_wallet.address
	const session_duration = 24 * 60 * 60 // 24 hours = 86400

	const sessionPayload = {
		from: signerAddress,
		spec: core.multihash,
		timestamp: Math.round(Date.now() / 1000),
		session_public_key,
		session_duration,
	}

	const sessionSignatureData = getSessionSignatureData(sessionPayload)
	const sessionSignature = await signer._signTypedData(...sessionSignatureData)
	const session = { payload: sessionPayload, signature: sessionSignature }

	await core.session(session)

	const actionTimestamp = Math.round(Date.now() / 1000)
	const actionPayload = {
		from: signerAddress,
		spec: core.multihash,
		call: "thread",
		args: ["0", "title", "http://example.com/"],
		timestamp: actionTimestamp,
	}

	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await session_wallet._signTypedData(...actionSignatureData)
	const action = { payload: actionPayload, session: session_wallet.address, signature: actionSignature }

	const { hash } = await core.apply(action)
	t.is(hash, ethers.utils.sha256(actionSignature))

	t.deepEqual(core.getRoute("/latest"), [
		{
			id: "0",
			timestamp: actionTimestamp,
			title: "title",
			link: "http://example.com/",
			creator: signerAddress,
			score: null,
			voters: null,
		},
	])

	await core.close()
})
