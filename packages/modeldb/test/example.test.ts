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

	const userAId = await db.add("user", userA)
	t.log("userAId", userAId)
	t.deepEqual(await db.get("user", userAId), userA)
	t.is(await db.count("user"), 1)

	const userBId = await db.add("user", userB)
	t.log("userBId", userBId)
	t.deepEqual(await db.get("user", userBId), userB)
	t.is(await db.count("user"), 2)

	const room = {
		creator: userAId,
		members: [userAId, userBId],
	}

	const roomId = await db.add("room", room)
	t.log("roomId", roomId)
	t.deepEqual(await db.get("room", roomId), room)
	t.is(await db.count("room"), 1)

	const message = {
		room: roomId,
		sender: userAId,
		content: "hello world",
		timestamp: Date.now(),
	}

	const messageId = await db.add("message", message)
	const messageId2 = await db.add("message", message)
	const messageId3 = await db.add("message", message)

	t.is(messageId, messageId2)
	t.is(messageId, messageId3)
	t.deepEqual(await db.get("message", messageId), message)
	t.is(await db.count("message"), 1)
})
