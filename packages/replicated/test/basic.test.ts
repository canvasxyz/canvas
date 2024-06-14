import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/replicated"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const test = ava as TestFn<{ chat: Chat; signer: SIWESigner }>

// TODO: avoid mutating base class, immutable initializer
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
		super.tx.message(message)
	}
	async onMessage(message: string): Promise<void> {
		this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

test.beforeEach(async (t) => {
	t.context.chat = await Chat.initialize({ topic: crypto.randomBytes(8).toString("hex") })
	t.context.signer = new SIWESigner({ signer: ethers.Wallet.createRandom() })
})

test.afterEach.always(async (t) => {
	const { chat } = t.context
	await chat.stop()
})

test.serial("send two messages", async (t) => {
	const { chat } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.tx.message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	await chat.tx.message("hello")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 2)
})

test.serial("send messages using an explicit call", async (t) => {
	const { chat } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.tx.message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	await chat.tx.messageFromChild("hi from explicit call")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 2)
})

test.serial("send messages using an implicit call and .as()", async (t) => {
	const { chat, signer } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.as(signer).message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)
})

test.serial("send messages using an explicit call and .as()", async (t) => {
	const { chat, signer } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.as(signer).messageFromChild("hi from explicit call")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	const messages = await chat.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(messages?.[0].message, "hi from explicit call")
})
