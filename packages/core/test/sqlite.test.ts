import test from "ava"

import { ethers } from "ethers"

import { Core, compileSpec } from "@canvas-js/core"
import { ActionArgument, ActionPayload, getActionSignatureData } from "@canvas-js/interfaces"

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
	routes: {
		"/all": `SELECT threads.*, SUM(thread_votes.value) AS score FROM threads LEFT JOIN thread_votes ON threads.id = thread_votes.thread_id GROUP BY threads.id ORDER BY threads.updated_at DESC`,
		"/votes/:thread_id": "SELECT creator, value FROM thread_votes WHERE thread_id = :thread_id",
	},
})

async function sign(call: string, args: Record<string, ActionArgument>) {
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
	return { payload: actionPayload, session: null, signature: actionSignature }
}

test("get /all", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true, offline: true })

	const action = await sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.applyAction(action)

	const expected = {
		id: threadId,
		title: "Hacker News",
		creator: signerAddress,
		link: "https://news.ycombinator.com",
		updated_at: action.payload.timestamp,
	}

	t.deepEqual(await core.getRoute("/all", {}), [{ ...expected, score: null }])

	await sign("voteThread", { threadId, value: 1 }).then((action) => core.applyAction(action))
	t.deepEqual(await core.getRoute("/all", {}), [{ ...expected, score: 1 }])

	await sign("voteThread", { threadId, value: -1 }).then((action) => core.applyAction(action))
	t.deepEqual(await core.getRoute("/all", {}), [{ ...expected, score: -1 }])

	await core.close()
})

test("get /votes/:thread_id", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true })

	const action = await sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.applyAction(action)

	await sign("voteThread", { threadId, value: 1 }).then((action) => core.applyAction(action))
	t.deepEqual(await core.getRoute("/votes/:thread_id", { thread_id: threadId }), [{ creator: signerAddress, value: 1 }])

	await sign("voteThread", { threadId, value: -1 }).then((action) => core.applyAction(action))
	t.deepEqual(await core.getRoute("/votes/:thread_id", { thread_id: threadId }), [
		{ creator: signerAddress, value: -1 },
	])

	await core.close()
})
