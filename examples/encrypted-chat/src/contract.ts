import type { ModelSchema, Actions } from "@canvas-js/core"
import { EthEncryptedData } from "@metamask/eth-sig-util"

export const models = {
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
		$indexes: ["timestamp"],
	},
} satisfies ModelSchema

export const actions = {
	registerEncryptionKey({ key }: { key: string }) {
		const { address, db } = this
		db.set("encryptionKeys", { address, key })
	},
	createEncryptionGroup({
		members,
		groupKeys,
		groupPublicKey,
	}: {
		members: string[]
		groupKeys: EthEncryptedData[]
		groupPublicKey: string
	}) {
		const { address, db } = this
		// TODO: enforce the encryption group is sorted correctly, and each groupKey is registered correctly
		if (members.indexOf(address) === -1) throw new Error()
		const id = members.join()

		db.set("encryptionGroups", {
			id,
			groupKeys: JSON.stringify(groupKeys),
			key: groupPublicKey,
		})
	},
	sendPrivateMessage({ group, ciphertext }: { group: string; ciphertext: string }) {
		// TODO: check address is in group
		const { timestamp, id, db } = this
		db.set("privateMessages", { id, ciphertext, group, timestamp })
	},
} satisfies Actions<typeof models>
