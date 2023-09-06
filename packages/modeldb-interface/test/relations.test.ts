import { ModelsInit } from "@canvas-js/modeldb-interface"

import { testOnModelDB } from "./utils.js"

const models: ModelsInit = {
	user: { address: "string" },

	room: {
		creator: "@user",
		members: "@user[]",
	},

	message: {
		room: "@room",
		sender: "@user",
		content: "string",
		timestamp: "integer",
	},
}

testOnModelDB("set and get reference and relation values", async (t, openDB) => {
	const db = await openDB(models)

	const userA = await db.add("user", { address: "a" })
	const userB = await db.add("user", { address: "b" })

	t.is(await db.count("user"), 2)

	const roomId = await db.add("room", { creator: userA, members: [userA, userB] })
	t.deepEqual(await db.get("room", roomId), { creator: userA, members: [userA, userB] })
})
