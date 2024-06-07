import test from "ava"
import { ReplicatedObject } from "@canvas-js/replicated"
import { Awaitable } from "@canvas-js/interfaces"

class Chat extends ReplicatedObject<{
	sendMessage: (message: string) => Awaitable<void>
}> {
	static db = {
		messages: {
			id: "primary",
			message: "string",
			address: "string",
			timestamp: "string",
		},
	}
	async onSendMessage(message: string): Promise<void> {
		this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

test.serial("send a message", async (t) => {
	const chat = new Chat()
	await chat.ready()

	const app = await chat.getApp()

	await chat.sendMessage("hi")
	t.log("count", await app?.db.count("messages"))

	await chat.sendMessage("hello")

	chat.stop()
	t.pass()
})
