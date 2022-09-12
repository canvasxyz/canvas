import test from "ava"

import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"

import { ActionArgument, getActionSignatureData } from "@canvas-js/interfaces"
import { Core, SqliteStore, compileSpec } from "@canvas-js/core"

const quickJS = await getQuickJS()

const signer = ethers.Wallet.createRandom()
const signerAddress = signer.address.toLowerCase()

test("Test setting and then deleting a record", async (t) => {
	const store = new SqliteStore(null)
	const { name, spec } = await compileSpec({
		models: { threads: { title: "string", link: "string", creator: "string" } },
		actions: {
			newThread(title, link) {
				if (typeof title === "string" && typeof link === "string") {
					this.db.threads.set(this.hash, { creator: this.from, title, link })
				}
			},
			deleteThread(threadId) {
				if (typeof threadId === "string") {
					this.db.threads.delete(threadId)
				}
			},
		},
	})

	async function sign(signer: ethers.Wallet, session: string | null, call: string, args: ActionArgument[]) {
		const timestamp = Date.now()
		const actionPayload = { from: signerAddress, spec: name, call, args, timestamp }
		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await signer._signTypedData(...actionSignatureData)
		return { payload: actionPayload, session, signature: actionSignature }
	}

	const core = await Core.initialize({ name, directory: null, store, spec, quickJS, unchecked: true })

	const newThreadAction = await sign(signer, null, "newThread", ["Hacker News", "https://news.ycombinator.com"])

	const { hash: threadId } = await core.apply(newThreadAction)

	t.deepEqual(store.database.prepare("SELECT * FROM threads").all(), [
		{
			id: threadId,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signerAddress,
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await sign(signer, null, "deleteThread", [threadId]).then((action) => core.apply(action))

	t.deepEqual(store.database.prepare("SELECT * FROM threads").all(), [])

	await core.close()
})
