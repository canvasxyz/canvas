import test from "ava"

import { Core } from "@canvas-js/core"

import { TestSigner, compileSpec } from "./utils.js"

const { spec, app, appName } = await compileSpec({
	name: "Test App",
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

const signer = new TestSigner(app, appName)

test("Test setting and then deleting a record", async (t) => {
	const core = await Core.initialize({ spec, directory: null, libp2p: null, unchecked: true })

	const newThreadAction = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })

	const { hash: threadId } = await core.apply(newThreadAction)

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [
		{
			id: threadId,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signer.wallet.address,
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await signer.sign("deleteThread", { threadId }).then((action) => core.apply(action))

	t.deepEqual(core.modelStore.database.prepare("SELECT * FROM threads").all(), [])

	await core.close()
})
