import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/replicated"
import { Awaitable } from "@canvas-js/interfaces"
import { SIWESigner } from "@canvas-js/chain-ethereum"

import { encryptSafely, decryptSafely, getEncryptionPublicKey, EthEncryptedData } from "@metamask/eth-sig-util"

const test = ava as TestFn<{
	alice: SIWESigner
	bob: SIWESigner
	alicePrivkey: string
	bobPrivkey: string
	chat: EncryptedChat
}>

const formatAddress = (address: `0x${string}` | null | undefined) => {
	return address?.slice(0, 6)
}
const toCAIP = (address: `0x${string}`) => {
	return "eip155:1:" + address
}
const fromCAIP = (caip: string): `0x${string}` => {
	const address = caip.replace("eip155:1:", "")
	if (!isHex(address)) throw new Error("Invalid address")
	return address
}
const isHex = (address: string): address is `0x${string}` => {
	return address.startsWith("0x")
}
const getGroupId = (address1: string, address2: string) => {
	return address1 < address2 ? `${address1},${address2}` : `${address1},${address2}`
}

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

	// should be on a `local` scope instead?
	async registerEncryptionKey(privateKey: string): Promise<void> {
		return this.tx.registerEncryptionKey(getEncryptionPublicKey(privateKey.slice(2)))
	}
	async createEncryptionGroup(recipient: `0x${string}`): Promise<string> {
		const wallet = {} as any // TODO

		const myKey = await this.db.get("encryptionKeys", toCAIP(wallet.address))
		if (!myKey) throw new Error("Wallet has not registered an encryption key")

		const recipientKey = await this.db.get("encryptionKeys", toCAIP(recipient))
		if (!recipientKey) throw new Error("Recipient has not registered an encryption key")

		const members = [wallet.address, recipient]
		const groupId = getGroupId(this.address, recipient)

		const groupPrivateKey = ethers.Wallet.createRandom().privateKey
		const groupPublicKey = getEncryptionPublicKey(groupPrivateKey.slice(2))
		const groupKeys = (await Promise.all(members.map((member) => this.db.get("encryptionKeys", toCAIP(member)))))
			.map((result) => result?.key)
			.map((key) => {
				return encryptSafely({ publicKey: key as string, data: groupPrivateKey, version: "x25519-xsalsa20-poly1305" })
			})

		await this.tx.createEncryptionGroup(groupId, members, groupKeys, groupPublicKey)
		return groupId
	}

	onRegisterEncryptionKey(key: string) {
		this.db.set("encryptionKeys", { address: this.address, key })
	}
	onCreateEncryptionGroup(members: string[], groupKeys: string[], groupPublicKey: string) {
		// TODO: enforce the encryption group is sorted correctly, and each groupKey is registered correctly
		if (members.indexOf(fromCAIP(this.address)) === -1) throw new Error()
		const id = members.join()

		this.db.set("encryptionGroups", {
			id,
			groupKeys: JSON.stringify(groupKeys),
			key: groupPublicKey,
		})
	}
	onSendPrivateMessage(group: string, ciphertext: string) {
		// TODO: check address is in group
		this.db.set("privateMessages", { id: this.id, ciphertext, group, timestamp: this.timestamp })
	}
}

test.beforeEach(async (t) => {
	t.context.chat = await EncryptedChat.initialize({ topic: crypto.randomBytes(8).toString("hex") })
	t.context.alice = new SIWESigner({ signer: ethers.Wallet.createRandom() })
	t.context.bob = new SIWESigner({ signer: ethers.Wallet.createRandom() })
})

test.afterEach.always(async (t) => {
	const { chat } = t.context
	await chat.stop()
})

test.serial("send two messages", async (t) => {
	const { chat, alice, alicePrivkey, bob, bobPrivkey } = t.context

	await chat.as(alice).registerEncryptionKey(alicePrivkey)
	await chat.as(bob).registerEncryptionKey(bobPrivkey)

	const groupId = await chat.as(alice).createEncryptionGroup(await bob.getAddress())
	await chat.as(alice).sendPrivateMessage(groupId, "hello (secret)")

	t.is(await chat.app?.db.count("encryptionKeys"), 2)
	t.is(await chat.app?.db.count("encryptionGroups"), 1)
	t.is(await chat.app?.db.count("privateMessages"), 1)
})
