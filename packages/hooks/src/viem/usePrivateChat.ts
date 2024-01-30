import type { ActionImplementationFunction } from "@canvas-js/core"
import type { SessionSigner } from "@canvas-js/interfaces"
import { getEncryptionPublicKey, encryptSafely } from "@metamask/eth-sig-util"
import { ModelsInit } from "@canvas-js/modeldb"
import { Account } from "viem"
import { generatePrivateKey } from 'viem/accounts'

import { useCanvas } from "../useCanvas.js"
import { useLiveQuery } from "../useLiveQuery.js"
import { ethAddressToCAIP, caipToEthAddress, getGroupId } from "../utils.js"

interface PrivateChatConfig {
	topic: string
	discoveryTopic: string
	signers: SessionSigner[]
	account: Account
}

const models: ModelsInit = {
	encryptionKeys: {
		address: "primary",
		key: "string",
		$indexes: [["address"]],
	},
	encryptionGroups: {
		id: "primary",
		groupKeys: "string",
		key: "string",
		$indexes: [["id"]],
	},
	privateMessages: {
		id: "primary",
		ciphertext: "string",
		group: "string",
		timestamp: "integer",
		$indexes: [["timestamp"]],
	},
}

const actions: Record<string, ActionImplementationFunction> = {
	registerEncryptionKey: (db, { key }, { address }) => {
		db.set("encryptionKeys", { address, key })
	},
	createEncryptionGroup: (db, { members, groupKeys, groupPublicKey }, { address }) => {
		if (members.indexOf(caipToEthAddress(address)) === -1) throw new Error()
		db.set("encryptionGroups", { id: members.join(), groupKeys: JSON.stringify(groupKeys), key: groupPublicKey })
	},
	sendPrivateMessage: (db, { group, ciphertext }, { timestamp, id }) => {
		// TODO: check address is in group
		db.set("privateMessages", { id, ciphertext, group, timestamp })
	},
}

export const usePrivateChat = ({ topic, discoveryTopic, signers, account }: PrivateChatConfig) => {
	const { app } = useCanvas({
		signers,
		discoveryTopic,
		contract: {
			topic,
			models,
			actions,
		},
	})

	const people = useLiveQuery(app, "encryptionKeys", { orderBy: { address: "desc" } })

	return {
		account,
		app,
		people,
		registerEncryptionKey: async (privateKey: string) => {
			if (!app) throw new Error()
			const key = getEncryptionPublicKey(privateKey.slice(2))
			return app.actions.registerEncryptionKey({ key })
		},
		createEncryptionGroup: async (recipient: string) => {
			if (!app) throw new Error()
			if (!account) throw new Error()

			const myKey = await app.db.get("encryptionKeys", ethAddressToCAIP(account.address))
			if (!myKey) throw new Error("Wallet has not registered an encryption key")

			const recipientKey = await app.db.get("encryptionKeys", ethAddressToCAIP(recipient))
			if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

			const members = [account.address, recipient]
			const group = getGroupId(account.address, recipient)

			const groupPrivateKey = generatePrivateKey()
			const groupPublicKey = getEncryptionPublicKey(groupPrivateKey.slice(2))
			const groupKeys = (
				await Promise.all(members.map((member) => app.db.get("encryptionKeys", ethAddressToCAIP(member))))
			)
				.map((result) => result?.key)
				.map((key) => {
					return encryptSafely({ publicKey: key as string, data: groupPrivateKey, version: "x25519-xsalsa20-poly1305" })
				})

			await app.actions.createEncryptionGroup({ id: group, members, groupKeys, groupPublicKey })
		},
		sendPrivateMessage: async (recipient: string, message: string) => {
			if (!app) throw new Error()
			if (!account?.address) throw new Error()

			const address = account?.address
			const group = getGroupId(address, recipient)
			const encryptionGroup = await app.db.get("encryptionGroups", group)

			if (!encryptionGroup) throw new Error("Invalid group")

			const encryptedData = encryptSafely({
				publicKey: encryptionGroup.key as string,
				data: message,
				version: "x25519-xsalsa20-poly1305",
			})
			const ciphertext = JSON.stringify(encryptedData)
			await app.actions.sendPrivateMessage({ group, ciphertext })
		},
	}
}
