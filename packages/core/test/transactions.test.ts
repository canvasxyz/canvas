import assert from "assert"
import Prando from "prando"

import test, { ExecutionContext } from "ava"

import { AbstractModelDB, ModelValue } from "@canvas-js/modeldb"
import { Actions, Canvas, decodeRecordValue, ModelSchema } from "@canvas-js/core"
import { SECONDS } from "@canvas-js/utils"

import { PRNGSigner } from "./utils.js"

const steps = 100
const chainLength = 8

test("increment a counter, reading outside the transaction", async (t) => {
	const rng = new Prando.default(0)

	const random = (n: number) => rng.nextInt(0, n - 1)

	const models = {
		counter: { id: "primary", value: "integer" },
	} satisfies ModelSchema

	const actions = {
		async increment() {
			const { db } = this
			const record = await db.get("counter", "counter")
			await db.transaction(async () => {
				if (record === null) {
					await db.set("counter", { id: "counter", value: 1 })
				} else {
					await db.set("counter", { id: "counter", value: record.value + 1 })
				}
			})
		},
	} satisfies Actions<typeof models>

	const init = async (t: ExecutionContext<unknown>, seed: number) => {
		const app = await Canvas.initialize({
			contract: { models, actions },
			topic: "com.example.app",
			signers: [new PRNGSigner(seed)],
		})

		t.teardown(() => app.stop())
		return app
	}

	const [app1, app2] = await Promise.all([init(t, 1), init(t, 2)])

	let total = 0

	const apps = [app1, app2]
	for (let i = 0; i < steps; i++) {
		const app = apps[random(2)]
		const count = 1 + random(chainLength)
		for (let j = 0; j < count; j++) {
			total += 1
			await app.actions.increment()
		}

		if (random(2) === 0) {
			await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
		}

		if (random(2) === 0) {
			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
		}
	}

	await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	const counter1 = await app1.db.get<{ id: string; value: number }>("counter", "counter")
	const counter2 = await app2.db.get<{ id: string; value: number }>("counter", "counter")

	t.log("total", total)
	t.log("counter1", counter1?.value)
	t.log("counter2", counter2?.value)

	t.is(counter1?.value, counter2?.value)
	t.true(counter1!.value < total)
	t.true(counter2!.value < total)

	for await (const { csx, value } of app1.db.iterate<{ value: Uint8Array; csx: number | null }>("$writes", {
		orderBy: { "record_id/csx/message_id": "asc" },
	})) {
		t.deepEqual(decodeRecordValue(app1.db.config, "counter", value), { id: "counter", value: csx })
	}

	for await (const { csx, value } of app2.db.iterate<{ value: Uint8Array; csx: number | null }>("$writes", {
		orderBy: { "record_id/csx/message_id": "asc" },
	})) {
		t.deepEqual(decodeRecordValue(app1.db.config, "counter", value), { id: "counter", value: csx })
	}
})

test("increment a counter, reading inside the transaction", async (t) => {
	t.timeout(10 * SECONDS)
	const rng = new Prando.default(0)
	const random = (n: number) => rng.nextInt(0, n - 1)

	const models = {
		counter: { id: "primary", value: "integer" },
	} satisfies ModelSchema

	const actions = {
		async increment() {
			const { db } = this
			let value = 1
			await db.transaction(async () => {
				const record = await db.get("counter", "counter")
				if (record !== null) {
					value = record.value + 1
				}
				await db.set("counter", { id: "counter", value })
			})

			return value
		},
	} satisfies Actions<typeof models>

	const init = async (t: ExecutionContext<unknown>, seed: number) => {
		const app = await Canvas.initialize({
			contract: { models, actions },
			topic: "com.example.app",
			signers: [new PRNGSigner(seed)],
		})

		t.teardown(() => app.stop())
		return app
	}

	const [app1, app2] = await Promise.all([init(t, 1), init(t, 2)])

	let total = 0
	let time = 0
	let last: number

	const apps = [app1, app2]
	for (let i = 0; i < steps; i++) {
		const n = random(2)
		const app = apps[n]
		const count = 1 + random(chainLength)
		for (let j = 0; j < count; j++) {
			total += 1
			const start = performance.now()
			const { id, result } = await app.actions.increment()
			// console.log(`increment app${n + 1} ->`, id, result)
			last = performance.now() - start
			time += last
		}

		if (random(2) === 0) {
			// console.log("syncing app2 -> app1")
			await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
		}

		if (random(2) === 0) {
			// console.log("syncing app1 -> app2")
			await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
		}
	}

	t.log(`total time: ${time.toPrecision(5)}ms`)
	t.log(`time per insert: ${(time / total).toPrecision(5)}ms`)
	t.log(`time for last insert: ${last!.toPrecision(5)}ms`)

	await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))
	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	const counter1 = await app1.db.get<{ id: string; value: number }>("counter", "counter")
	const counter2 = await app2.db.get<{ id: string; value: number }>("counter", "counter")

	await compare(t, app1.db, app2.db, "$writes", ":")
	await compare(t, app1.db, app2.db, "$reads", ":")
	await compare(t, app1.db, app2.db, "$reverts", ":")
	await compare(t, app1.db, app2.db, "$records", ":")
	await compare(t, app1.db, app2.db, "counter", ":")

	t.log("total", total)
	t.log("counter1", counter1?.value)
	t.log("counter2", counter2?.value)

	t.pass()
})

test("test read conflict", async (t) => {
	const rng = new Prando.default(0)
	const random = (n: number) => rng.nextInt(0, n - 1)

	/**
	 * Alright how do we test for read conflicts?
	 * We'll use a chat room with `admins: string[]` and `members: string[]` arrays
	 */

	type Room = { id: string; admins: string[]; members: string[] }
	type Post = { id: string; room: string; author: string; content: string }
	const models = {
		rooms: { id: "primary", admins: "json", members: "json" },
		posts: { id: "primary", room: "@rooms", author: "string", content: "string" },
	} satisfies ModelSchema

	const actions = {
		async createRoom() {
			await this.db.transaction(() =>
				this.db.set("rooms", { id: this.id, admins: [this.did], members: [this.did] } satisfies Room),
			)
			return this.id
		},

		async createPost(roomId: string, content: string) {
			const { db } = this
			return await db.transaction(async () => {
				const room = await db.get("rooms", roomId)
				assert(room !== null, "room not found")
				const { members } = room as Room
				assert(members.includes(this.did), "unauthorized")
				await db.set("posts", { id: this.id, room: roomId, author: this.did, content } satisfies Post)
				return this.id
			})
		},

		async addMember(roomId: string, member: string) {
			const { db } = this
			await db.transaction(async () => {
				const room = await db.get("rooms", roomId)
				assert(room !== null, "room not found")
				const { admins, members } = room as Room
				assert(members.includes(this.did) && admins.includes(this.did), "unauthorized")
				assert(!members.includes(member), "already a member")
				await db.set("rooms", { ...room, members: [...members, member] })
			})
		},

		async removeMember(roomId: string, member: string) {
			const { db } = this
			await db.transaction(async () => {
				const room = await db.get("rooms", roomId)
				assert(room !== null, "room not found")
				const { admins, members } = room as Room
				assert(members.includes(this.did) && admins.includes(this.did), "unauthorized")
				assert(members.includes(member), "not a member")
				await db.set("rooms", { ...room, members: members.filter((did) => did !== member) })
			})
		},
	} satisfies Actions<typeof models>

	const init = async (t: ExecutionContext<unknown>, seed: number) => {
		const app = await Canvas.initialize({
			contract: { models, actions },
			topic: "com.example.app",
			signers: [new PRNGSigner(seed)],
		})

		t.teardown(() => app.stop())
		return app
	}

	/**
	 * Alright the essential thing we're trying to test here
	 * is to make sure that members who get removed can't still
	 * post by just branching "around" the removal.
	 */

	const [app1, app2] = await Promise.all([init(t, 1), init(t, 2)])
	const [did1, did2] = await Promise.all([app1.signers.getFirst().getDid(), app2.signers.getFirst().getDid()])

	const { result: roomId } = await app1.actions.createRoom()
	const post1 = await app1.actions.createPost(roomId, "hello world")
	await app1.actions.addMember(roomId, did2)

	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))

	const post2 = await app2.actions.createPost(roomId, "it's a-me, a-mario")

	// alright if we stop here we expect

	t.deepEqual(await app1.db.getAll("rooms"), [{ id: roomId, admins: [did1], members: [did1, did2] }])
	t.deepEqual(await app1.db.getAll("posts"), [
		{ id: post1.id, room: roomId, author: did1, content: post1.message.payload.args[1] },
	])

	t.deepEqual(await app2.db.getAll("rooms"), [{ id: roomId, admins: [did1], members: [did1, did2] }])
	t.deepEqual(await app2.db.getAll("posts"), [
		{ id: post1.id, room: roomId, author: did1, content: post1.message.payload.args[1] },
		{ id: post2.id, room: roomId, author: did2, content: post2.message.payload.args[1] },
	])

	// Then we have did1 remove did2 from the room members list...
	await app1.actions.removeMember(roomId, did2)

	// ... and sync both apps...
	await app1.messageLog.serve((snapshot) => app2.messageLog.sync(snapshot))
	await app2.messageLog.serve((snapshot) => app1.messageLog.sync(snapshot))

	// ... which should result in post2 getting reverted in both apps
	t.deepEqual(await app1.db.getAll("rooms"), [{ id: roomId, admins: [did1], members: [did1] }])
	t.deepEqual(await app1.db.getAll("posts"), [
		{ id: post1.id, room: roomId, author: did1, content: post1.message.payload.args[1] },
	])

	t.deepEqual(await app2.db.getAll("rooms"), [{ id: roomId, admins: [did1], members: [did1] }])
	t.deepEqual(await app2.db.getAll("posts"), [
		{ id: post1.id, room: roomId, author: did1, content: post1.message.payload.args[1] },
	])

	t.pass()
})

async function compare(
	t: ExecutionContext<unknown>,
	a: AbstractModelDB,
	b: AbstractModelDB,
	model: string,
	keyDelimiter = "/",
) {
	t.deepEqual(await collect(a, model, keyDelimiter), await collect(b, model, keyDelimiter))
}

async function collect(db: AbstractModelDB, model: string, keyDelimiter = "/"): Promise<Record<string, ModelValue>> {
	const values: Record<string, ModelValue> = {}

	const { primaryKey } = db.models[model]
	for await (const value of db.iterate(model, { orderBy: { [primaryKey.join("/")]: "asc" } })) {
		const key = primaryKey.map((name) => value[name]).join(keyDelimiter)
		values[key] = value
	}

	return values
}
