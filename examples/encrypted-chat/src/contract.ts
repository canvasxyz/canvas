import type { ActionSchema, ModelSchema } from "@canvas-js/core"

const models = {
	encryptionKeys: {
		address: "primary",
		key: "string",
	},
	encryptionGroups: {
		id: "primary",
		groupKeys: "string",
		key: "string",
	},
	privateMessages: {
		id: "primary",
		ciphertext: "string",
		group: "string",
		timestamp: "integer",
		$indexes: [["timestamp"]],
	},
} satisfies ModelSchema

export const actions = {
	registerEncryptionKey: (db, { key }, { address }) => {
		db.set("encryptionKeys", { address, key })
	},
	createEncryptionGroup: (db, { members, groupKeys, groupPublicKey }, { address }) => {
		// TODO: enforce the encryption group is sorted correctly, and each groupKey is registered correctly
		if (members.indexOf(address) === -1) throw new Error()
		const id = members.join()

		db.set("encryptionGroups", {
			id,
			groupKeys: JSON.stringify(groupKeys),
			key: groupPublicKey,
		})
	},
	sendPrivateMessage: (db, { group, ciphertext }, { timestamp, id }) => {
		// TODO: check address is in group
		db.set("privateMessages", { id, ciphertext, group, timestamp })
	},
} satisfies ActionSchema<typeof models>

export const contract = { models, actions }
