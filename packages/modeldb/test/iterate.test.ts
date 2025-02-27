import { randomBytes } from "node:crypto"
import { testOnModelDB, testOnModelDBNoWasm } from "./utils.js"

testOnModelDB("iterate (select)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { id: "primary", is_moderator: "boolean", name: "string?" },
	})

	const [a, b] = ["a", "b"]
	await db.set("user", { id: a, is_moderator: true, name: "John Doe" })
	await db.set("user", { id: b, is_moderator: false, name: null })

	t.deepEqual(await collect(db.iterate("user", {})), [
		{ id: a, is_moderator: true, name: "John Doe" },
		{ id: b, is_moderator: false, name: null },
	])

	t.deepEqual(await collect(db.iterate("user", { select: { id: true } })), [{ id: a }, { id: b }])
	t.deepEqual(await collect(db.iterate("user", { select: { id: true, name: false } })), [{ id: a }, { id: b }])
	t.deepEqual(await collect(db.iterate("user", { select: { id: true, is_moderator: true, name: true } })), [
		{ id: a, is_moderator: true, name: "John Doe" },
		{ id: b, is_moderator: false, name: null },
	])

	t.deepEqual(await collect(db.iterate("user", { select: { id: true, name: true } })), [
		{ id: a, name: "John Doe" },
		{ id: b, name: null },
	])
})

testOnModelDB("iterate (orderBy)", async (t, openDB) => {
	const db = await openDB(t, {
		user: { id: "primary" },
	})

	const users: { id: string }[] = []
	for (let i = 0; i < 100; i++) {
		const user = { id: randomBytes(8).toString("hex") }
		await db.set("user", user)
		users.push(user)
	}

	users.sort((a, b) => (a.id < b.id ? -1 : 1))
	t.deepEqual(await collect(db.iterate("user", { orderBy: { id: "asc" } })), users)

	users.sort((a, b) => (a.id < b.id ? 1 : -1))
	t.deepEqual(await collect(db.iterate("user", { orderBy: { id: "desc" } })), users)
})

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
	const items: T[] = []
	for await (const item of iter) {
		items.push(item)
	}
	return items
}
