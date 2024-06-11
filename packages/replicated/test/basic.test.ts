import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ReplicatedObject } from "@canvas-js/replicated"

const test = ava as TestFn<{ chat: Chat }>

class Chat extends ReplicatedObject<{ message: (message: string) => void }> {
	static db = {
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "integer",
		},
	}
	async onMessage(message: string): Promise<void> {
		this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

test.beforeEach(async (t) => {
	t.context.chat = await Chat.initialize({ topic: crypto.randomBytes(8).toString("hex") })
})

test.afterEach.always(async (t) => {
	const { chat } = t.context
	await chat.stop()
})

test.serial("send two messages", async (t) => {
	const { chat } = t.context

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.tx.message("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000))
	t.is(await chat.app?.db.count("messages"), 1)

	await chat.tx.message("hello")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000))
	t.is(await chat.app?.db.count("messages"), 2)
})
