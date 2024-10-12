import test from "ava"

import { Canvas, Contract, Config } from "@canvas-js/core"
import { Action, Session, Message } from "@canvas-js/interfaces"
import { MergeFunction } from "@canvas-js/modeldb"

test("snapshot persists data across apps", async (t) => {
	const config: Config = {
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
				},
			},
			actions: {
				async createPost(db, { id, content }: { id: string; content: string }) {
					await db.set("posts", { id, content })
				},
				async deletePost(db, { id }: { id: string }) {
					await db.delete("posts", id)
				},
			},
		},
	}

	const app = await Canvas.initialize(config)

	const [clock0, parents0] = await app.messageLog.getClock()
	t.is(clock0, 1)
	t.is(parents0.length, 0)

	await app.actions.createPost({ id: "a", content: "foo" })
	await app.actions.createPost({ id: "b", content: "bar" })
	await app.actions.createPost({ id: "c", content: "qux" })
	await app.actions.createPost({ id: "d", content: "baz" })
	await app.actions.deletePost({ id: "b" })
	await app.actions.deletePost({ id: "d" })

	const [clock, parents] = await app.messageLog.getClock()
	t.is(clock, 8) // one session, six actions
	t.is(parents.length, 1)

	// snapshot and add some more actions
	const snapshot = await app.createSnapshot()
	await app.stop()

	const app2 = await Canvas.initialize({ reset: true, snapshot, ...config })

	t.is((await app2.db.get("posts", "a"))?.content, "foo")
	t.is(await app2.db.get("posts", "b"), null)
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is(await app2.db.get("posts", "e"), null)

	await app2.actions.createPost({ id: "a", content: "1" })
	await app2.actions.createPost({ id: "b", content: "2" })
	await app2.actions.createPost({ id: "e", content: "3" })
	await app2.actions.createPost({ id: "f", content: "4" })

	const [clock2, parents2] = await app2.messageLog.getClock()
	t.is(clock2, 7) // one snapshot, one session, four actions
	t.is(parents2.length, 1)

	t.is((await app2.db.get("posts", "a"))?.content, "1")
	t.is((await app2.db.get("posts", "b"))?.content, "2")
	t.is((await app2.db.get("posts", "c"))?.content, "qux")
	t.is(await app2.db.get("posts", "d"), null)
	t.is((await app2.db.get("posts", "e"))?.content, "3")
	t.is((await app2.db.get("posts", "f"))?.content, "4")

	// snapshot a second time
	const snapshot2 = await app2.createSnapshot()
	const app3 = await Canvas.initialize({ reset: true, snapshot: snapshot2, ...config })

	t.is((await app3.db.get("posts", "a"))?.content, "1")
	t.is((await app3.db.get("posts", "b"))?.content, "2")
	t.is((await app3.db.get("posts", "c"))?.content, "qux")
	t.is(await app3.db.get("posts", "d"), null)
	t.is((await app3.db.get("posts", "e"))?.content, "3")
	t.is((await app3.db.get("posts", "f"))?.content, "4")
	t.is(await app3.db.get("posts", "g"), null)

	const [clock3] = await app3.messageLog.getClock()
	t.is(clock3, 2) // one snapshot
	t.is(parents2.length, 1)
})

test("snapshot persists data with merge functions", async (t) => {
	const config: Config<{
		posts: {
			id: "primary",
			content: "string",
			$merge: MergeFunction<any>
		}
	}> = {
		topic: "com.example.app",
		contract: {
			models: {
				posts: {
					id: "primary",
					content: "string",
					$merge: ({ id, content }, { content: content2 }) => {
						return { id, content: content + content2 }
					},
				},
			},
			actions: {
				async createPost(db, { id, content }: { id: string; content: string }) {
					await db.set("posts", { id, content })
				},
				async deletePost(db, { id }: { id: string }) {
					await db.delete("posts", id)
				},
			},
		}
	}

	const app = await Canvas.initialize(config)

	const session = await app.signers.getFirst().newSession(config.topic)
	const sessionMessage: Message<Session> = {
		topic: config.topic,
		clock: 1,
		parents: [],
		payload: session.payload,
	}
	const sessionMessageSignature = await session.signer.sign(sessionMessage)
	const { id: idSession } = await app.insert(sessionMessageSignature, sessionMessage)

	const a: Message<Action> = {
		topic: config.topic,
		clock: 2,
		parents: [idSession],
		payload: {
			type: "action",
			did: session.payload.did,
			name: "createPost",
			args: { id: "a", content: "foo" },
			context: { timestamp: new Date().getTime() },
		},
	}
	await app.insert(await session.signer.sign(a), a)

	const b: Message<Action> = {
		topic: config.topic,
		clock: 2,
		parents: [idSession],
		payload: {
			type: "action",
			did: session.payload.did,
			name: "createPost",
			args: { id: "a", content: "foo" },
			context: { timestamp: new Date().getTime() },
		},
	}
	await app.insert(await session.signer.sign(b), b)

	t.deepEqual(await app.db.get("posts", "a"), { id: "a", content: "foofoo" })

	const snapshot = await app.createSnapshot()
	await app.stop()

	const app2 = await Canvas.initialize({ reset: true, snapshot, ...config })

	t.deepEqual(await app2.db.get("posts", "a"), { id: "a", content: "foofoo" })

	t.pass()
})

test("snapshot persists data with merge functions and inline contract", async (t) => {
	const contract = `export const contract = {
		models: {
			posts: {
				id: "primary",
				content: "string",
				$merge: ({ id, content }, { id: id2, content: content2 }) => {
					return { id, content: content + content2 }
				},
			},
		},
		actions: {
			async createPost(db, { id, content }) {
				await db.set("posts", { id, content })
			},
			async deletePost(db, { id }) {
				await db.delete("posts", id)
			},
		},
	}`

	const config = {
		topic: "com.example.app",
		contract,
	}

	const app = await Canvas.initialize(config)

	const session = await app.signers.getFirst().newSession(config.topic)
	const sessionMessage: Message<Session> = {
		topic: config.topic,
		clock: 1,
		parents: [],
		payload: session.payload,
	}
	const sessionMessageSignature = await session.signer.sign(sessionMessage)
	const { id: idSession } = await app.insert(sessionMessageSignature, sessionMessage)

	const a: Message<Action> = {
		topic: config.topic,
		clock: 2,
		parents: [idSession],
		payload: {
			type: "action",
			did: session.payload.did,
			name: "createPost",
			args: { id: "a", content: "foo" },
			context: { timestamp: new Date().getTime() },
		},
	}
	await app.insert(await session.signer.sign(a), a)

	const b: Message<Action> = {
		topic: config.topic,
		clock: 2,
		parents: [idSession],
		payload: {
			type: "action",
			did: session.payload.did,
			name: "createPost",
			args: { id: "a", content: "foo" },
			context: { timestamp: new Date().getTime() },
		},
	}
	await app.insert(await session.signer.sign(b), b)

	t.deepEqual(await app.db.get("posts", "a"), { id: "a", content: "foofoo" })

	const snapshot = await app.createSnapshot()
	await app.stop()

	const app2 = await Canvas.initialize({ reset: true, snapshot, ...config })

	t.deepEqual(await app2.db.get("posts", "a"), { id: "a", content: "foofoo" })

	t.pass()
})
