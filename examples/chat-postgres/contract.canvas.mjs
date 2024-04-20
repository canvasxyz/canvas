export const topic = "chat-example.canvas.xyz"

export const models = {
	message: {
		id: "primary",
		address: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["address", "timestamp"],
	},
}

export const actions = {
	async createMessage(db, { content }, { id, address, timestamp }) {
		console.log("received message:", content)
		await db.set("message", { id, address, content, timestamp })
	},
}
