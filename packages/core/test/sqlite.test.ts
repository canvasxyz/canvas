import test from "ava"

import { Core } from "@canvas-js/core"

import { TestSigner, compileSpec } from "./utils.js"

const { spec, app, appName } = await compileSpec({
	name: "Test App",
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
		"/all": ({ offset = 0 }, { db }) => {
			return db.queryRaw(
				`SELECT threads.*, SUM(thread_votes.value) AS score FROM threads LEFT JOIN thread_votes ON threads.id = thread_votes.thread_id GROUP BY threads.id ORDER BY threads.updated_at DESC LIMIT 50 OFFSET :offset`,
				{ offset }
			)
			// return db
			// 	.select("threads.*", db.sum("thread_votes.value").as("score"))
			// 	.from("threads")
			// 	.join("thread_votes", "threads.id = thread_votes.thread_id")
			// 	.groupBy("threads.id")
			// 	.orderBy("threads.updated_at")
			// 	.order("desc")
		},
		"/votes/:thread_id": ({ thread_id }, { db }) => {
			return db.queryRaw("SELECT creator, value FROM thread_votes WHERE thread_id = ? LIMIT 50", [
				thread_id,
				// { offset: 0 },
			])
			// return db.select(["creator, value"]).from("thread_votes").where("thread_id = ?", [thread_id])
		},
	},
})

const signer = new TestSigner(app, appName)

test("get /all", async (t) => {
	const core = await Core.initialize({ uri: app, spec, directory: null, offline: true, unchecked: true })

	const action = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.apply(action)

	const expected = {
		id: threadId,
		title: "Hacker News",
		creator: signer.wallet.address,
		link: "https://news.ycombinator.com",
		updated_at: action.payload.timestamp,
	}

	t.deepEqual(await core.getRoute("/all", {}), [{ ...expected, score: null }])

	await signer.sign("voteThread", { threadId, value: 1 }).then((action) => core.apply(action))
	t.deepEqual(await core.getRoute("/all", {}), [{ ...expected, score: 1 }])

	await signer.sign("voteThread", { threadId, value: -1 }).then((action) => core.apply(action))
	t.deepEqual(await core.getRoute("/all", {}), [{ ...expected, score: -1 }])

	await core.close()
})

test("get /votes/:thread_id", async (t) => {
	const core = await Core.initialize({ uri: app, spec, directory: null, offline: true, unchecked: true })

	const action = await signer.sign("newThread", { title: "Hacker News", link: "https://news.ycombinator.com" })
	const { hash: threadId } = await core.apply(action)

	await signer.sign("voteThread", { threadId, value: 1 }).then((action) => core.apply(action))
	t.deepEqual(await core.getRoute("/votes/:thread_id", { thread_id: threadId }), [
		{ creator: signer.wallet.address, value: 1 },
	])

	await signer.sign("voteThread", { threadId, value: -1 }).then((action) => core.apply(action))
	t.deepEqual(await core.getRoute("/votes/:thread_id", { thread_id: threadId }), [
		{ creator: signer.wallet.address, value: -1 },
	])

	await core.close()
})
