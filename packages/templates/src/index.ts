import type { Contract } from "@canvas-js/core"

export const PublicChat = {
	models: {
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "integer",
			$indexes: [["timestamp"], ["address"]],
		},
	},
	actions: {
		sendMessage: (db, { message }: { message: string }, { address, timestamp, id }) => {
			if (!message || !message.trim()) throw new Error()
			db.set("messages", { id, message, address, timestamp })
		},
	},
} satisfies Contract

export const ChannelChat = {
	models: {
		channels: {
			name: "primary",
		},
		memberships: {
			id: "primary",
			user: "string",
			channel: "string",
			timestamp: "integer",
		},
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "integer",
			channel: "string",
			$indexes: [["channel"], ["address"]],
		},
	},
	actions: {
		async leaveChannel(db, { channel }, { address, timestamp, id }) {
			await db.delete("memberships", address + channel)
		},
		async joinChannel(db, { channel }, { address, timestamp, id }) {
			if (!channel || !channel.trim()) {
				throw new Error()
			}

			await db.set("channels", { name: channel })
			await db.set("memberships", { id: `${address}/${channel}`, user: address, channel, timestamp })
		},
		async sendMessage(db, { message, channel }, { address, timestamp, id }) {
			if (!message || !channel || !message.trim() || !channel.trim()) {
				throw new Error()
			}

			await db.set("messages", { id, message, address, channel, timestamp })
		},
		async deleteMessage(db, { id }, { address, timestamp }) {
			const message = await db.get("messages", id)
			if (!message || message.address !== address) throw new Error()
			await db.delete("messages", id)
		},
	},
} satisfies Contract

export const Forum = {
	models: {
		categories: {
			name: "primary",
		},
		tags: {
			name: "primary",
		},
		memberships: {
			id: "primary",
			user: "string",
			category: "string",
			timestamp: "integer",
		},
		threads: {
			id: "primary",
			title: "string",
			message: "string",
			address: "string",
			timestamp: "integer",
			category: "string",
			replies: "integer",
			$indexes: [["category"], ["address"], ["timestamp"]],
		},
		replies: {
			id: "primary",
			threadId: "@threads",
			reply: "string",
			address: "string",
			timestamp: "integer",
			$indexes: [["threadId"]],
		},
	},
	actions: {
		async createTag(db, { tag }, { address, timestamp, id }) {
			if (!tag || !tag.trim()) throw new Error()
			await db.set("tags", { name: tag })
		},
		async deleteTag(db, { tag }, { address, timestamp, id }) {
			await db.delete("tags", tag)
		},
		async createCategory(db, { category }, { address, timestamp, id }) {
			if (!category || !category.trim()) throw new Error()
			await db.set("categories", { name: category })
		},
		async deleteCategory(db, { category }, { address, timestamp, id }) {
			await db.delete("categories", category)
		},
		async createThread(db, { title, message, category }, { address, timestamp, id }) {
			if (!message || !category || !title || !message.trim() || !category.trim() || !title.trim()) throw new Error()
			await db.set("threads", { id, title, message, category, address, timestamp, replies: 0 })
		},
		async deleteMessage(db, { id }, { address, timestamp }) {
			const message = await db.get("threads", id)
			if (!message || message.address !== address) throw new Error()
			await db.delete("threads", id)
		},
		async createReply(db, { threadId, reply }, { address, timestamp, id }) {
			const thread = await db.get("threads", threadId)
			if (!thread || !threadId) throw new Error()
			await db.set("threads", { ...thread, replies: (thread.replies as number) + 1 })
			await db.set("replies", { id, threadId, reply, address, timestamp })
		},
		async deleteReply(db, { replyId }, { address, timestamp, id }) {
			const reply = await db.get("replies", replyId)
			if (!reply) throw new Error()
			const thread = await db.get("threads", reply.threadId as string)
			if (!thread) throw new Error()
			await db.set("threads", { ...thread, replies: (thread.replies as number) - 1 })
			await db.delete("replies", replyId)
		},
	},
} satisfies Contract
