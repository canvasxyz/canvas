import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/replicated"
import { Awaitable } from "@canvas-js/interfaces"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { encryptSafely, decryptSafely, getEncryptionPublicKey, EthEncryptedData } from "@metamask/eth-sig-util"

/*
 * Encrypted chat with non-ratcheting groups.
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
			group: "string",
			timestamp: "integer",
			$indexes: [["timestamp"]],
		},
	}

	// client actor functions - should be on a `client` scope instead?
	async registerEncryptionKey(privateKey: string): Promise<void> {
		const encryptionPublicKey = getEncryptionPublicKey(privateKey.slice(2))
		return super.tx.registerEncryptionKey(encryptionPublicKey)
	}
	async createEncryptionGroup(recipient: `0x${string}`): Promise<string> {
		const myKey = await this.db.get("encryptionKeys", this.address)
		if (!myKey) throw new Error("Wallet has not registered an encryption key")

		const recipientKey = await this.db.get("encryptionKeys", recipient)
		if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

		function getGroupId(address1: string, address2: string) {
			return address1 < address2 ? `${address1}:${address2}` : `${address1}:${address2}`
		}
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
		const members = groupId.split(':')
		if (members.indexOf(this.address) === -1) throw new Error()

		this.db.set("encryptionGroups", {
			id: groupId,
			groupKeys: JSON.stringify(groupKeys),
			key: groupPublicKey,
		})
	}
	onSendPrivateMessage(group: string, ciphertext: string) {
		// TODO: check address is in group
		this.db.set("privateMessages", { id: this.id, ciphertext, group, timestamp: this.timestamp })
	}
}

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

test.serial("exchange two messages", async (t) => {
	const { chat, alice, alicePrivkey, bob, bobPrivkey } = t.context

	const aliceChat = chat.as(alice)
	const bobChat = chat.as(bob)

	await aliceChat.registerEncryptionKey(alicePrivkey)
	await bobChat.registerEncryptionKey(bobPrivkey)

	const groupId = await aliceChat.createEncryptionGroup(bob.getAddressFromDid(await bob.getDid()))
	await aliceChat.sendPrivateMessage(groupId, "psst hello")

	t.is(await chat.app?.db.count("encryptionKeys"), 2)
	t.is(await chat.app?.db.count("encryptionGroups"), 1)
	t.is(await chat.app?.db.count("privateMessages"), 1)
	// TODO: decrypt chat as bob
})
