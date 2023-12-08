import { randomBytes, bytesToHex } from "@noble/hashes/utils"

export const contractTemplate = (topic = `chat-${bytesToHex(randomBytes(4))}`) =>
	`
// A Canvas backend for a simple chat application.

export const topic = "${topic}"

export const models = {
	messages: {
		id: "primary",
		user: "string",
		content: "string",
		timestamp: "integer",
		$indexes: ["timestamp"],
	},
};

export const actions = {
	async createMessage(db, { content }, { id, chain, address, timestamp }) {
		const user = [chain, address].join(":")
		await db.messages.set({ id, content, user, timestamp });
	},
	async deleteMessage(db, { messageId }, { chain, address }) {
		const message = await db.messages.get(messageId)
		if (message !== null) {
			const user = [chain, address].join(":")
			if (message.user !== user) {
				throw new Error("unauthorized")
			}
			
			await db.messages.delete(messageId);
		}
	},
};
`.trim()
