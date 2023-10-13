import { nanoid } from "nanoid"

import type { ModelsInit } from "@canvas-js/modeldb"

import { testOnModelDB } from "./utils.js"

const models: ModelsInit = {
	user: {
		address: "string",
		encryptionPublicKey: "bytes",
		signingPublicKey: "bytes",
	},

	room: {
		creator: "@user",
		members: "@user[]",
		$indexes: ["members"],
	},

	message: {
		room: "@room",
		sender: "@user",
		content: "string",
		timestamp: "integer",
	},
}

testOnModelDB("create ModelDB", async (t, openDB) => {
	const db = await openDB(models)

	const userA = {
		address: "a",
		encryptionPublicKey: new Uint8Array([1, 2, 3]),
		signingPublicKey: new Uint8Array([4, 5, 6]),
	}

	const userB = {
		address: "b",
		encryptionPublicKey: new Uint8Array([7, 8, 9]),
		signingPublicKey: new Uint8Array([0xa, 0xb, 0xc]),
	}

	t.is(await db.count("user"), 0)

	const [userAId, userBId] = [nanoid(), nanoid()]
	await db.set("user", userAId, userA)
	t.log("userAId", userAId)
	t.deepEqual(await db.get("user", userAId), userA)
	t.is(await db.count("user"), 1)

	await db.set("user", userBId, userB)
	t.log("userBId", userBId)
	t.deepEqual(await db.get("user", userBId), userB)
	t.is(await db.count("user"), 2)

	const room = {
		creator: userAId,
		members: [userAId, userBId],
	}

	const [roomId] = [nanoid()]
	await db.set("room", roomId, room)
	t.log("roomId", roomId)
	t.deepEqual(await db.get("room", roomId), room)
	t.is(await db.count("room"), 1)
})
