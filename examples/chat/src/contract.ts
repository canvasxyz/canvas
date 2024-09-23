import type { Contract } from "@canvas-js/core"

export const contract = {
	models: {
		message: {
			id: "primary",
			address: "string",
			content: "string",
			timestamp: "integer",
			$indexes: ["address", "timestamp"],
		},
	},
	actions: {
		async createMessage(db, { content }, { id, address, timestamp }) {
			await db.set("message", { id, address, content, timestamp })
		},
	},
} satisfies Contract
