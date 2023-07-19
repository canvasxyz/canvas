import test from "ava"

import { ModelDB, ModelsInit } from "@canvas-js/modeldb"

const models: ModelsInit = {
	user: {
		address: "string",
		encryptionPublicKey: "bytes",
		signingPublicKey: "bytes",
	},

	// @ts-ignore
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

test("create ModelDB", (t) => {
	const modelDB = new ModelDB("db.sqlite", models, { dkLen: 10 })

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

	const userAId = modelDB.add("user", userA, { namespace: "ETP2CYzLFAqWnTpybcTHJp" })
	t.log("userAId", userAId)
	t.deepEqual(modelDB.get("user", userAId), userA)

	const userBId = modelDB.add("user", userB, { namespace: "ETP2CYzLFAqWnTpybcTHJp" })
	t.log("userBId", userBId)
	t.deepEqual(modelDB.get("user", userBId), userB)

	const room = {
		creator: userAId,
		members: [userAId, userBId],
	}

	const roomId = modelDB.add("room", room, { namespace: "ETP2CYzLFAqWnTpybcTHJp" })
	t.log("roomId", roomId)
	t.deepEqual(modelDB.get("room", roomId), room)

	const message = {
		room: roomId,
		sender: userAId,
		content: "hello world",
		timestamp: Date.now(),
	}

	const messageId = modelDB.add("message", message)
	const messageId2 = modelDB.add("message", message)
	const messageId3 = modelDB.add("message", message)

	t.deepEqual(messageId, messageId2)
	t.deepEqual(messageId, messageId3)
	t.deepEqual(modelDB.get("message", messageId), message)

	// modelDB.remove("message", messageId)
	// t.is(modelDB.get("message", messageId), null)

	// modelDB.remove("room", roomId)
	// t.is(modelDB.get("room", roomId), null)

	// modelDB.remove("user", userBId)
	// modelDB.remove("user", userAId)

	// t.is(modelDB.get("user", userBId), null)
	// t.is(modelDB.get("user", userAId), null)
})
