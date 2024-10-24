import type { Actions, ModelSchema } from "@canvas-js/core"

const models = {
	message: {
		id: "primary",
		address: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["address", "timestamp"],
	},
} satisfies ModelSchema

export const actions = {
	async createMessage(db, { content }, { id, address, timestamp }) {
		await db.set("message", { id, address, content, timestamp })
	},
} satisfies Actions<typeof models>

export const contract = { models, actions }
