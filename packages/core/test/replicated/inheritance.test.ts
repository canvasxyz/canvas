import crypto from "crypto"
import ava, { TestFn } from "ava"
import { ethers } from "ethers"
import { ReplicatedObject } from "@canvas-js/core"
import { SIWESigner } from "@canvas-js/chain-ethereum"

const test = ava as TestFn<{
	chat: Chat
	child: ChatChild
	grandchild: ChatGrandchild
	signer: SIWESigner
	messages: number
}>

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

	async message(message: string): Promise<void> {
		await this.tx.message("0" + message)
	}
	async messageSkip(message: string) {
		await this.tx.message("00" + message)
	}
	async onMessage(message: string): Promise<void> {
		await this.db.set("messages", { id: this.id, message, address: this.address, timestamp: this.timestamp })
	}
}

class ChatChild extends Chat {
	async message(message: string) {
		await this.tx.message("1" + message)
	}
	async message2(message: string) {
		await this.tx.message("11" + message)
	}
	async message4(message: string) {
		await this.tx.message("1111" + message)
	}
}

class ChatGrandchild extends ChatChild {
	async message(message: string) {
		await this.tx.message("2" + message)
	}
	async message2(message: string) {
		await this.tx.message("22" + message)
	}
	async message3(message: string) {
		await this.tx.message2("222" + message)
	}
	async message4(message: string) {
		await this.tx.message4("2222" + message)
	}
	async messageSkip(message: string) {
		await this.tx.messageSkip("22222" + message)
	}
	async messageSkip2(message: string) {
		await this.tx.message("222222" + message)
	}
}

test.before(async (t) => {
	const rand = () => crypto.randomBytes(8).toString("hex")
	t.context.chat = await Chat.initialize({ topic: rand() })
	t.context.child = await ChatChild.initialize({ topic: rand() })
	t.context.grandchild = await ChatGrandchild.initialize({ topic: rand() })
	t.context.messages = 0

	t.context.signer = new SIWESigner({
		signer: ethers.Wallet.createRandom(),
	})
})

test.after.always(async (t) => {
	await t.context.chat.stop()
	await t.context.child.stop()
	await t.context.grandchild.stop()
})

// message -> message
test.serial("nested call", async (t) => {
	await t.context.child.message("hello world")
	t.context.messages++
	const message = await t.context.grandchild.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(message?.[0].message, "01hello world")
})

// message -> message -> message
test.serial("doubly nested call, aliased", async (t) => {
	await t.context.grandchild.message("hello world")
	t.context.messages++
	const message = await t.context.grandchild.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(message?.[0].message, "012hello world")
})

// message3 -> message2 -> message
test.serial("doubly nested call, unaliased", async (t) => {
	await t.context.grandchild.message3("hello world")
	t.context.messages++
	const message = await t.context.grandchild.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(message?.[0].message, "011222hello world")
})

// message4 -> message4 -> message
test.serial("doubly nested call, first aliased", async (t) => {
	await t.context.grandchild.message4("hello world")
	t.context.messages++
	const message = await t.context.grandchild.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(message?.[0].message, "011112222hello world")
})

// message2 -> message -> message
test.serial("doubly nested call, second aliased", async (t) => {
	await t.context.grandchild.message2("hello world")
	t.context.messages++
	const message = await t.context.grandchild.app?.db.query("messages", { orderBy: { timestamp: "desc" } })
	t.is(message?.[0].message, "0122hello world")
})

// messageSkip -> [skip] -> messageSkip
test.serial("skip level call throws error", async (t) => {
	await t.throwsAsync(async () => t.context.grandchild.messageSkip("hello world"))
})
