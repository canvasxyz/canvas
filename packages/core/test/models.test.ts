import { Model } from "@canvas-js/core"

import { testPlatforms } from "./utils.js"

testPlatforms("validate that $models is populated", async (t, open) => {
	const app = await open(t, {
		contract: {
			models: {
				rooms: { id: "primary", admin_did: "string" },
				posts: { id: "primary", room_id: "string", content: "string" },
				memberships: { id: "primary" }, // `${room.id}/${did}`
			},
			actions: {},
		},
		topic: "com.example.app",
	})

	const models = await app.db.query<{ name: string; model: Model }>("$models", { orderBy: { name: "asc" } })

	t.deepEqual(models, [
		{
			name: "memberships",
			model: { name: "memberships", primaryKey: "id", properties: [{ name: "id", kind: "primary" }], indexes: [] },
		},
		{
			name: "posts",
			model: {
				name: "posts",
				primaryKey: "id",
				properties: [
					{ name: "id", kind: "primary" },
					{ name: "room_id", kind: "primitive", type: "string", nullable: false },
					{ name: "content", kind: "primitive", type: "string", nullable: false },
				],
				indexes: [],
			},
		},
		{
			name: "rooms",
			model: {
				name: "rooms",
				primaryKey: "id",
				properties: [
					{ name: "id", kind: "primary" },
					{ name: "admin_did", kind: "primitive", type: "string", nullable: false },
				],
				indexes: [],
			},
		},
	])
})
