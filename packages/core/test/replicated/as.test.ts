import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const test = ava as TestFn<{ chat: Chat; signer: SIWESigner }>

/**
 * Test objects
 */
class Chat extends ReplicatedObject<{
	message: (message: string) => void
	messageFromChild: (message: string) => void
}> {
	static db = {
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "integer",
		},
	}
	async messageFromChild(message: string): Promise<void> {
		await this.tx.message("[" + this.address + "] " + message)
	}
	async onMessage(message: string): Promise<void> {
		await this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

/**
 * Test initializers
 */
test.beforeEach(async (t) => {
	t.context.chat = await Chat.initialize({ topic: crypto.randomBytes(8).toString("hex") })
	t.context.signer = new SIWESigner({ signer: ethers.Wallet.createRandom() })
})

test.afterEach.always(async (t) => {
	const { chat } = t.context
	await chat.stop()
})

/**
 * Tests
 */
test.serial("send messages using an implicit call and .as()", async (t) => {
	const { chat, signer } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.as(signer).message("hi")
	t.is(await chat.app?.db.count("messages"), 1)

	const messages = await chat.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(messages?.[0].message, "hi")
	t.is(messages?.[0].address, await signer.getWalletAddress())
})

test.serial("send messages using an explicit call and .as()", async (t) => {
	const { chat, signer } = t.context

	t.is(await chat.app?.db.count("messages"), 0)
	await chat.as(signer, await signer._signer.getAddress()).messageFromChild("hi from explicit call")
	t.is(await chat.app?.db.count("messages"), 1)

	const messages = await chat.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(messages?.[0].message, `[${messages?.[0].address}] hi from explicit call`)
	t.is(messages?.[0].address, await signer.getWalletAddress())
})
