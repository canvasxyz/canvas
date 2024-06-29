import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/core"
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
		super.tx.message("[" + this.address + "] " + message)
	}
	async onMessage(message: string): Promise<void> {
		this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

class ChildChat extends Chat {
	async messageFromChild(message: string): Promise<void> {
		super.tx.messageFromChild("[child] " + message)
	}
	async skipMessageFromChild(message: string): Promise<void> {
		super.tx.message("[child] " + message)
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

test.serial("handlers called with this.id, this.address, this.timestamp", async (t) => {
	const { chat } = t.context

	await chat.message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	const messages = await chat.app?.db.query("messages")
	const message = messages?.[0]

	t.assert(messages?.length === 1, "one message")
	t.assert(typeof message?.id === "string", "message id is string")
	t.assert(message?.id.length === 32, "message id is 32 bytes")
	t.assert(typeof message?.address === "string", "message address is string")
	t.assert(message?.address.startsWith("0x"), "message address starts with 0x")
	t.assert(typeof message?.timestamp === "number", "message timestamp is number")
	t.assert(message?.timestamp !== 0, "message timestamp is nonzero")
})

test.serial("send two messages", async (t) => {
	const { chat } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	await chat.message("hello")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 2)
})

test.serial("send messages using an explicit call", async (t) => {
	const { chat } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	await chat.messageFromChild("hi from explicit call")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 2)

	const messages = await chat.app?.db.query("messages")
	t.is(messages?.[1].message, `[${messages?.[0].address}] hi from explicit call`)
})

test.serial("send messages using an implicit call and .as()", async (t) => {
	const { chat, signer } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.as(signer).message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	const messages = await chat.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(messages?.[0].message, "hi")
	t.is(messages?.[0].address, await signer.getWalletAddress())
})

test.serial("send messages using an explicit call and .as()", async (t) => {
	const { chat, signer } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.as(signer).messageFromChild("hi from explicit call")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await chat.app?.db.count("messages"), 1)

	const messages = await chat.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(messages?.[0].message, `[${messages?.[0].address}] hi from explicit call`)
	t.is(messages?.[0].address, await signer.getWalletAddress())
})

test.serial("test multiple levels of inheritance, nested and skip-level calls", async (t) => {
	const child = await ChildChat.initialize({ topic: crypto.randomBytes(8).toString("hex") })

	await child.messageFromChild("test")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 100))
	t.is(await child.app?.db.count("messages"), 1)

	const messages = await child.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(messages?.[0].message, `[child] [${messages?.[0].address}] test`)
})
