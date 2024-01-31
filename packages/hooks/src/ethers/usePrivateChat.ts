import { useState, useEffect } from "react"
import type { ActionImplementationFunction } from "@canvas-js/core"
import type { SessionSigner } from "@canvas-js/interfaces"
import { getEncryptionPublicKey, encryptSafely } from "@metamask/eth-sig-util"
import { ModelsInit } from "@canvas-js/modeldb"
import { ethers } from "ethers"

import { useCanvas } from "../useCanvas.js"
import { useLiveQuery } from "../useLiveQuery.js"
import { ethAddressToCAIP, caipToEthAddress, getGroupId } from "../utils.js"

interface PrivateChatConfig {
	topic: string
	discoveryTopic: string
	signers: SessionSigner[]
	wallet: ethers.Wallet
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

export const usePrivateChat = ({ topic, discoveryTopic, signers, wallet }: PrivateChatConfig) => {
	const [conversationAddress, setConversationAddress] = useState<string>()

	const { app } = useCanvas({
		signers,
		discoveryTopic,
		contract: {
			topic,
			models,
			actions,
		},
	})

	// list of all conversations
	const people = useLiveQuery(app, "encryptionKeys", { orderBy: { address: "desc" } })

	// active conversation
	const groups = useLiveQuery(app, "encryptionGroups", {
		where: { id: conversationAddress ? getGroupId(wallet.address, conversationAddress) : "" },
	})

	const messages = useLiveQuery(app, "privateMessages", {
		where: { group: conversationAddress ? getGroupId(wallet.address, conversationAddress) : "" },
	})

	useEffect(() => {
		if (!app) return
		// create a new registration key for the local user
		const createEncryptionKey = async () => {
			if (!wallet.privateKey) return
			const myKey = await app.db.get("encryptionKeys", ethAddressToCAIP(wallet.address))
			if (myKey) return
			const key = getEncryptionPublicKey(wallet.privateKey.slice(2))
			app.actions.registerEncryptionKey({ key })
			location.reload()
		}
		createEncryptionKey()

		// create a new encryption group with `conversationAddress`
		if (!conversationAddress || !groups || groups.length > 0) return
		const createEncryptionGroup = async (recipient: string) => {
			if (!app) throw new Error()
			if (!wallet) throw new Error()

			const myKey = await app.db.get("encryptionKeys", ethAddressToCAIP(wallet.address))
			if (!myKey) throw new Error("Wallet has not registered an encryption key")

			const recipientKey = await app.db.get("encryptionKeys", recipient)
			if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

			const members = [wallet.address, recipient]
			const group = getGroupId(wallet.address, recipient)

			const groupPrivateKey = ethers.Wallet.createRandom().privateKey
			const groupPublicKey = getEncryptionPublicKey(groupPrivateKey.slice(2))
			const groupKeys = (
				await Promise.all(members.map((member) => app.db.get("encryptionKeys", ethAddressToCAIP(member))))
			)
				.map((result) => result?.key)
			const encryptedGroupKeys = groupKeys.map((key) => {
				return encryptSafely({ publicKey: key as string, data: groupPrivateKey, version: "x25519-xsalsa20-poly1305" })
			})

			await app.actions.createEncryptionGroup({ id: group, members, groupKeys: encryptedGroupKeys, groupPublicKey })
		}

		createEncryptionGroup(conversationAddress)
	}, [wallet.privateKey, conversationAddress, (groups || []).length])

	return {
		wallet,
		app,
		people,
		selectConversation: setConversationAddress,
		conversationAddress,
		conversationMessages: messages,
		sendPrivateMessage: async (recipient: string, message: string) => {
			if (!app) throw new Error()
			if (!wallet?.address) throw new Error()

			const address = wallet?.address
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
