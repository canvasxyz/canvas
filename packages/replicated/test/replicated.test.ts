import test from "ava"
import { Replicated as ReplicatedObject } from "@canvas-js/replicated"

class Chat extends ReplicatedObject {
	static db = {}
	onSendMessage(message: string) {}
}

test.serial("do nothing", async (t) => {
	const chat = new Chat()
	await chat.ready()

	chat.stop()
	t.pass()
})
