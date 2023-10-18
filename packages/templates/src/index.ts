import type { TemplateInlineContract } from "@canvas-js/core"

export const PublicChat: TemplateInlineContract = {
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
		sendMessage: (db, { message }, { address, timestamp, id }) => {
			if (!message || !message.trim()) throw new Error()
			db.messages.set({ id, message, address, timestamp })
		},
	},
}

export const ChannelChat: TemplateInlineContract = {
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
		leaveChannel: (db, { channel }, { address, timestamp, id }) => {
			db.memberships.delete(address + channel)
		},
		joinChannel: (db, { channel }, { address, timestamp, id }) => {
			if (!channel || !channel.trim()) {
				throw new Error()
			}

			db.channels.set({ name: channel })
			db.memberships.set({ id: `${address}/${channel}`, user: address, channel, timestamp })
		},
		sendMessage: (db, { message, channel }, { address, timestamp, id }) => {
			if (!message || !channel || !message.trim() || !channel.trim()) {
				throw new Error()
			}

			db.messages.set({ id, message, address, channel, timestamp })
		},
		deleteMessage: async (db, { id }, { address, timestamp }) => {
			const message = await db.messages.get(id)
			if (!message || message.address !== address) throw new Error()
			db.messages.delete(id)
		},
	},
}

export const Forum: TemplateInlineContract = {
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
			$indexes: [["category"], ["address"]],
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
		createTag: (db, { tag }, { address, timestamp, id }) => {
			if (!tag || !tag.trim()) throw new Error()
			db.tags.set({ name: tag })
		},
		deleteTag: (db, { tag }, { address, timestamp, id }) => {
			db.tags.delete(tag)
		},
		createCategory: (db, { category }, { address, timestamp, id }) => {
			if (!category || !category.trim()) throw new Error()
			db.categories.set({ name: category })
		},
		deleteCategory: (db, { category }, { address, timestamp, id }) => {
			db.categories.delete(category)
		},
		createThread: (db, { title, message, category }, { address, timestamp, id }) => {
			if (!message || !category || !title || !message.trim() || !category.trim() || !title.trim()) throw new Error()
			db.threads.set({ id, title, message, category, address, timestamp, replies: 0 })
		},
		deleteMessage: async (db, { id }, { address, timestamp }) => {
			// const message = await db.threads.get(id)
			// if (!message || message.address !== address) throw new Error()
			db.threads.delete(id)
		},
		createReply: async (db, { threadId, reply }, { address, timestamp, id }) => {
			// const thread = await db.threads.get(threadId)
			// if (!thread || !threadId) throw new Error()
			// db.threads.set({ ...thread, replies: (thread.replies as number) + 1 })
			db.replies.set({ id, threadId, reply, address, timestamp })
		},
		deleteReply: async (db, { replyId }, { address, timestamp, id }) => {
			// const reply = await db.replies.get(replyId)
			// if (!reply) throw new Error()
			// const thread = await db.threads.get(reply.threadId as string)
			// if (!thread) throw new Error()
			// db.threads.set({ ...thread, replies: (thread.replies as number) - 1 })
			db.replies.delete(replyId)
		},
	},
}
