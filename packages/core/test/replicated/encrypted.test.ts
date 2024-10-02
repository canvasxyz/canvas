import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/core"
import { Awaitable } from "@canvas-js/interfaces"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { encryptSafely, decryptSafely, getEncryptionPublicKey, EthEncryptedData } from "@metamask/eth-sig-util"

function getGroupId(address1: string, address2: string) {
	return address1 < address2 ? `${address1}:${address2}` : `${address1}:${address2}`
}

/*
 * Test objects: Encrypted chat with non-ratcheting groups.
 */
class EncryptedChat extends ReplicatedObject<{
	registerEncryptionKey: (key: string) => Awaitable<void>
	createEncryptionGroup: (
		id: string,
		members: string[],
		groupKeys: EthEncryptedData[],
		groupPublicKey: string,
	) => Awaitable<void>
	sendPrivateMessage: (group: string, ciphertext: string) => Awaitable<void>
}> {
	static db = {
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
			groupId: "string",
			timestamp: "integer",
			$indexes: [["timestamp"]],
		},
	}

	// client actor functions - should be on a `client` scope instead?
	async decrypt(id: string, privateKey: string) {
		const message = await this.db.get("privateMessages", id)
		if (!message) return null

		// TODO: infer types
		const group = await this.db.get("encryptionGroups", message.groupId as string)
		if (!group) return null

		const groupAddresses = (group.id as string).split(":")
		const groupKeys = JSON.parse(group.groupKeys as string)
		const index = groupAddresses.indexOf(this.address)

		const groupPrivateKey = decryptSafely({ encryptedData: groupKeys[index], privateKey: privateKey.slice(2) })

		const encryptedData = JSON.parse(message.ciphertext as string)
		const plaintext = decryptSafely({ encryptedData, privateKey: groupPrivateKey.slice(2) })

		return plaintext
	}

	async sendPrivateMessage(recipient: string, message: string) {
		const groupId = getGroupId(this.address, recipient)
		const encryptionGroup = await this.db.get("encryptionGroups", groupId)
		if (!encryptionGroup) throw new Error("Invalid group")

		const encryptedData = encryptSafely({
			publicKey: encryptionGroup.key as string,
			data: message,
			version: "x25519-xsalsa20-poly1305",
		})
		const ciphertext = JSON.stringify(encryptedData)
		await super.tx.sendPrivateMessage(groupId, ciphertext)
	}

	async registerEncryptionKey(privateKey: string): Promise<void> {
		const encryptionPublicKey = getEncryptionPublicKey(privateKey.slice(2))
		return super.tx.registerEncryptionKey(encryptionPublicKey)
	}
	async createEncryptionGroup(recipient: `0x${string}`): Promise<string> {
		const myKey = await this.db.get("encryptionKeys", this.address)
		if (!myKey) throw new Error("Wallet has not registered an encryption key")

		const recipientKey = await this.db.get("encryptionKeys", recipient)
		if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

		const members = [this.address, recipient]
		const groupId = getGroupId(this.address, recipient)

		const groupPrivateKey = ethers.Wallet.createRandom().privateKey
		const groupPublicKey = getEncryptionPublicKey(groupPrivateKey.slice(2))
		const groupKeys = (await Promise.all(members.map((member) => this.db.get("encryptionKeys", member))))
			.map((result) => result?.key)
			.map((key) => {
				return encryptSafely({ publicKey: key as string, data: groupPrivateKey, version: "x25519-xsalsa20-poly1305" })
			})

		await super.tx.createEncryptionGroup(groupId, groupKeys, groupPublicKey)
		return groupId
	}

	onRegisterEncryptionKey(key: string) {
		this.db.set("encryptionKeys", { address: this.address, key })
	}
	onCreateEncryptionGroup(groupId: string, groupKeys: string[], groupPublicKey: string) {
		const members = groupId.split(":")
		if (members.indexOf(this.address) === -1) throw new Error()

		this.db.set("encryptionGroups", {
			id: groupId,
			groupKeys: JSON.stringify(groupKeys),
			key: groupPublicKey,
		})
	}
	onSendPrivateMessage(groupId: string, ciphertext: string) {
		// TODO: check address is in group
		this.db.set("privateMessages", { id: this.id, ciphertext, groupId, timestamp: this.timestamp })
	}
}

/**
 * Test initializers
 */
const test = ava as TestFn<{
	alice: SIWESigner
	bob: SIWESigner
	alicePrivkey: string
	bobPrivkey: string
	chat: EncryptedChat
}>

test.beforeEach(async (t) => {
	t.context.chat = await EncryptedChat.initialize({ topic: crypto.randomBytes(8).toString("hex") })
	const alice = ethers.Wallet.createRandom()
	const bob = ethers.Wallet.createRandom()
	t.context.alice = new SIWESigner({ signer: alice })
	t.context.bob = new SIWESigner({ signer: bob })
	t.context.alicePrivkey = alice.privateKey
	t.context.bobPrivkey = bob.privateKey
})

test.afterEach.always(async (t) => {
	const { chat } = t.context
	await chat.stop()
})

/**
 * Tests
 */
test.serial("exchange two messages", async (t) => {
	const { chat, alice, alicePrivkey, bob, bobPrivkey } = t.context

	// TODO: replace these once .as() actually implements partial application
	const aliceAddress = await alice._signer.getAddress()
	const bobAddress = await bob._signer.getAddress()
	const aliceChat = () => chat.as(alice, aliceAddress)
	const bobChat = () => chat.as(bob, bobAddress)

	await aliceChat().registerEncryptionKey(alicePrivkey)
	await bobChat().registerEncryptionKey(bobPrivkey)

	const groupId = await aliceChat().createEncryptionGroup(bob.getAddressFromDid(await bob.getDid()))
	await aliceChat().sendPrivateMessage(await bob.getWalletAddress(), "psst hello")

	const keys = await chat.app?.db.query("encryptionKeys")
	t.is(keys?.length, 2)

	const groups = await chat.app?.db.query("encryptionGroups")
	t.is(groups?.length, 1)

	const messages = await chat.app?.db.query("privateMessages")
	t.is(messages?.length, 1)

	const decrypted = await bobChat().decrypt(messages?.[0].id, bobPrivkey)
	t.is(decrypted, "psst hello")
})
