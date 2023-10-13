import type { TemplateInlineContract } from "@canvas-js/core"

export const PublicChat: TemplateInlineContract = {
	models: {
		messages: {
			message: "string",
			from: "string",
			timestamp: "integer",
			$indexes: [["timestamp"], ["from"]],
		},
	},
	actions: {
		sendMessage: (db, { message }, { address, timestamp, id }) => {
			if (!message || !message.trim()) throw new Error()
			db.messages.set(id, { message, from: address, timestamp })
		},
	},
}
