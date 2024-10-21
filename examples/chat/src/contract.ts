import type { Contract, ModelSchema } from "@canvas-js/core"

const models = {
	message: {
		id: "primary",
		address: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["address", "timestamp"],
	},
} satisfies ModelSchema

export const contract = {
	models,
	actions: {
		async createMessage(db, { content }, { id, address, timestamp }) {
			await db.set("message", { id, address, content, timestamp })
		},
	},
} satisfies Contract<typeof models>
