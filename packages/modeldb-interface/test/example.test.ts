import { ModelsInit } from "@canvas-js/modeldb-interface"
import { testOnModelDB } from "./utils.js"

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

testOnModelDB("create ModelDB", async (t, modelDBConstructor) => {
	const modelDB = await modelDBConstructor(models)

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

	const userAId = await modelDB.add("user", userA, { namespace: "ETP2CYzLFAqWnTpybcTHJp" })
	t.log("userAId", userAId)
	t.deepEqual(await modelDB.get("user", userAId), userA)

	const userBId = await modelDB.add("user", userB, { namespace: "ETP2CYzLFAqWnTpybcTHJp" })
	t.log("userBId", userBId)
	t.deepEqual(await modelDB.get("user", userBId), userB)

	const room = {
		creator: userAId,
		members: [userAId, userBId],
	}

	const roomId = await modelDB.add("room", room, { namespace: "ETP2CYzLFAqWnTpybcTHJp" })
	t.log("roomId", roomId)
	t.deepEqual(await modelDB.get("room", roomId), room)

	const message = {
		room: roomId,
		sender: userAId,
		content: "hello world",
		timestamp: Date.now(),
	}

	const messageId = await modelDB.add("message", message)
	const messageId2 = await modelDB.add("message", message)
	const messageId3 = await modelDB.add("message", message)

	t.deepEqual(messageId, messageId2)
	t.deepEqual(messageId, messageId3)
	t.deepEqual(await modelDB.get("message", messageId), message)
})
