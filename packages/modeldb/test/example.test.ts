import { nanoid } from "nanoid"

import type { ModelSchema } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

const models: ModelSchema = {
	user: {
		id: "primary",
		address: "string",
		encryptionPublicKey: "bytes",
		signingPublicKey: "bytes",
	},

	room: {
		id: "primary",
		creator: "@user",
		members: "@user[]",
		$indexes: ["members"],
	},
}

testOnModelDB("create ModelDB", async (t, openDB) => {
	const db = await openDB(t, models)

	const userA = {
		id: nanoid(),
		address: "a",
		encryptionPublicKey: new Uint8Array([1, 2, 3]),
		signingPublicKey: new Uint8Array([4, 5, 6]),
	}

	const userB = {
		id: nanoid(),
		address: "b",
		encryptionPublicKey: new Uint8Array([7, 8, 9]),
		signingPublicKey: new Uint8Array([0xa, 0xb, 0xc]),
	}

	t.is(await db.count("user"), 0)

	await db.set("user", userA)
	t.deepEqual(await db.get("user", userA.id), userA)
	t.is(await db.count("user"), 1)

	await db.set("user", userB)
	t.deepEqual(await db.get("user", userB.id), userB)
	t.is(await db.count("user"), 2)

	const room = {
		id: nanoid(),
		creator: userA.id,
		members: [userA.id, userB.id],
	}

	await db.set("room", room)
	t.deepEqual(await db.get("room", room.id), room)
	t.is(await db.count("room"), 1)
})
