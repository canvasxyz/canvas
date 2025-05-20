import type { ModelSchema } from "@canvas-js/core"
import { Contract } from "@canvas-js/core/contract"
import { EthEncryptedData } from "@metamask/eth-sig-util"

export default class EncryptedChat extends Contract<typeof EncryptedChat.models> {
	static models = {
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

	async registerEncryptionKey({ key }: { key: string }) {
		const { address, db } = this
		await db.set("encryptionKeys", { address, key })
	}

	async createEncryptionGroup({
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

		await db.set("encryptionGroups", {
			id,
			groupKeys: JSON.stringify(groupKeys),
			key: groupPublicKey,
		})
	}

	async sendPrivateMessage({ group, ciphertext }: { group: string; ciphertext: string }) {
		// TODO: check address is in group
		const { timestamp, id, db } = this
		await db.set("privateMessages", { id, ciphertext, group, timestamp })
	}
}
