import test from "ava"

import { ethers } from "ethers"
import { BrowserCore } from "../lib/index.js"

const signer = new ethers.Wallet("0x111111111111111111111111111111111111")
const from = await signer.getAddress()

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
