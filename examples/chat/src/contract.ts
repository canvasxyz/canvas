import type { Actions, ModelSchema } from "@canvas-js/core"

export const models = {
	message: {
		id: "primary",
		address: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["address", "timestamp"],
	},
} satisfies ModelSchema

export const actions = {
	async createMessage(db, content) {
		const { id, address, timestamp } = this
		await db.set("message", { id, address, content, timestamp })
	},
} satisfies Actions<typeof models>
