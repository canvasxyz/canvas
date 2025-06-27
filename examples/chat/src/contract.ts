import type { ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"

export default class Chat extends Contract<typeof Chat.models> {
	static topic = "chat-example.canvas.xyz"

	static models = {
		message: {
			id: "primary",
			address: "string",
			content: "string",
			timestamp: "integer",
			$indexes: ["address", "timestamp"],
		},
	} satisfies ModelSchema

	async createMessage(arg: string | { content: string }) {
		const { id, address, timestamp, db } = this
		const content = typeof arg === "string" ? arg : arg.content
		await db.set("message", { id, address, content, timestamp })
	}
}
