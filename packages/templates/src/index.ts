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
	},
}
