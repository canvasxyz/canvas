import test from "ava"

import { Core } from "@canvas-js/core"

import { TestSigner, compileSpec, collect } from "./utils.js"

const { spec, app } = await compileSpec({
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

const signer = new TestSigner(app)

test("Test setting and then deleting a record", async (t) => {
	const core = await Core.initialize({ spec, directory: null, offline: true, unchecked: true })

	const newThreadAction = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })

	const { hash: threadId } = await core.apply(newThreadAction)

	t.deepEqual(await collect(core.modelStore.exportModel("threads")), [
		{
			id: threadId,
			title: "Hacker News",
			link: "https://news.ycombinator.com",
			creator: signer.wallet.address,
			updated_at: newThreadAction.payload.timestamp,
		},
	])

	await signer.sign("deleteThread", { threadId }).then((action) => core.apply(action))

	t.deepEqual(await collect(core.modelStore.exportModel("threads")), [])

	await core.close()
})
