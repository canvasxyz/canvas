import test from "ava"

// test for the `count` function in the ModelDB class

import { ModelDB as ModelDBSqlite } from "@canvas-js/modeldb-sqlite"
import { nanoid } from "nanoid"
import { testOnModelDB } from "./utils.js"

testOnModelDB("count entries in a modeldb table", async (t, openDB) => {
	const db = await openDB(t, {
		user: {
			id: "primary",
			address: "string",
			type: "string",
		},
	})

	await db.set("user", {
		id: nanoid(),
		address: nanoid(),
		type: "admin",
	})

	await db.set("user", {
		id: nanoid(),
		address: nanoid(),
		type: "user",
	})

	await db.set("user", {
		id: nanoid(),
		address: nanoid(),
		type: "user",
	})

	t.is(await db.count("user"), 3)
})

testOnModelDB("count entries in a modeldb table with a where condition", async (t, openDB) => {
	const db = await openDB(t, {
		user: {
			id: "primary",
			address: "string",
			age: "number",
			type: "string",
		},
	})

	await db.set("user", {
		id: nanoid(),
		address: nanoid(),
		age: 20,
		type: "admin",
	})

	await db.set("user", {
		id: nanoid(),
		address: nanoid(),
		age: 25,
		type: "user",
	})

	await db.set("user", {
		id: nanoid(),
		address: nanoid(),
		age: 15,
		type: "user",
	})

	t.is(await db.count("user", { type: "user" }), 2)
	t.is(await db.count("user", { type: "admin" }), 1)
	t.is(await db.count("user", { type: "moderator" }), 0)
	t.is(await db.count("user", { type: { neq: "user" } }), 1)

	t.is(await db.count("user", { age: { gt: 21 } }), 1)
	t.is(await db.count("user", { age: { gte: 20 } }), 2)
	t.is(await db.count("user", { age: { gte: 15 } }), 3)
	t.is(await db.count("user", { age: { gt: 18, lt: 22 } }), 1)

	t.is(await db.count("user", { type: "user", age: { gt: 18 } }), 1)

	db.close()
})
