import test from "ava"

import { ethers } from "ethers"

import { ActionArgument, ActionPayload } from "@canvas-js/interfaces"
import { getActionSignatureData } from "@canvas-js/verifiers"
import { Core, compileSpec } from "@canvas-js/core"

const signer = ethers.Wallet.createRandom()
const signerAddress = signer.address.toLowerCase()

test("Test setting and then deleting a record", async (t) => {
	const { uri, spec } = await compileSpec({
		models: { threads: { id: "string", title: "string", link: "string", creator: "string", updated_at: "datetime" } },
		actions: {
			newThread({ title, link }, { db, hash, from }) {
				if (typeof title === "string" && typeof link === "string") {
					db.threads.set(hash, { creator: from, title, link })
				}
			},
			deleteThread({ threadId }, { db }) {
				if (typeof threadId === "string") {
					db.threads.delete(threadId)
				}
			},
		},
	})

	async function sign(
		signer: ethers.Wallet,
		session: string | null,
		call: string,
		args: Record<string, ActionArgument>
	) {
		const timestamp = Date.now()
		const actionPayload: ActionPayload = {
			from: signerAddress,
			spec: uri,
			call,
			args,
			timestamp,
			chain: "eth",
			chainId: 1,
			blockhash: null,
		}
		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await signer._signTypedData(...actionSignatureData)
		return { payload: actionPayload, session, signature: actionSignature }
	}

	const core = await Core.initialize({ uri, directory: null, spec, unchecked: true, offline: true })

	const newThreadAction = await sign(signer, null, "newThread", {
		title: "Hacker News",
		link: "https://news.ycombinator.com",
	})

	const { hash: threadId } = await core.applyAction(newThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: threadId,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signerAddress,
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await sign(signer, null, "deleteThread", { threadId }).then((action) => core.applyAction(action))

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [])

	await core.close()
})
