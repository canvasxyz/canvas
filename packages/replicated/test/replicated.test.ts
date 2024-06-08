import ava, { TestFn } from "ava"
import { ReplicatedObject } from "@canvas-js/replicated"
import { Awaitable } from "@canvas-js/interfaces"

const test = ava as TestFn<{ app: Chat }>

class Chat extends ReplicatedObject<{
	sendMessage: (message: string) => Awaitable<void>
}> {
	static db = {
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "integer",
		},
	}
	async onSendMessage(message: string): Promise<void> {
		this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

test.beforeEach(async (t) => {
	const chat = new Chat()
	await chat.ready()
	t.context.app = chat
})

test.afterEach(async (t) => {
	const chat = t.context.app
	await chat.stop()
})

test.serial("send two messages", async (t) => {
	const chat = t.context.app

	t.is(await chat.app?.db.count("messages"), 0)

	await chat.sendMessage("hi")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000))
	t.is(await chat.app?.db.count("messages"), 1)

	await chat.sendMessage("hello")
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1000))
	t.is(await chat.app?.db.count("messages"), 2)
})
