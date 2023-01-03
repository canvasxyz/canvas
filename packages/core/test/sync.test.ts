import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import stream from "node:stream"

import test from "ava"

import { nanoid } from "nanoid"
import toIterable from "stream-to-it"
import * as okra from "node-okra"

import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import type { Message } from "@canvas-js/interfaces"

import { BinaryMessage, fromBinaryAction, fromBinarySession, normalizeMessage } from "@canvas-js/core/lib/encoding.js"
import { MessageStore } from "@canvas-js/core/lib/messageStore.js"
import { compileSpec } from "@canvas-js/core/lib/utils.js"
import { handleIncomingStream, sync } from "@canvas-js/core/lib/rpc/index.js"

import { TestSigner } from "./utils.js"

const { uri, spec } = await compileSpec({
	models: {},
	actions: { log: ({ message }, {}) => console.log(message) },
})

// creates an in-memory bi-directional connection
function connect(): [
	source: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>,
	target: Duplex<Uint8ArrayList, Uint8ArrayList | Uint8Array>
] {
	const source = toIterable.duplex(new stream.PassThrough())
	const target = toIterable.duplex(new stream.PassThrough())
	return [
		{ source: source.source, sink: target.sink },
		{ source: target.source, sink: source.sink },
	]
}

async function insert(mst: okra.Tree, hash: Buffer, binaryMessage: BinaryMessage) {
	const leaf = Buffer.alloc(14)
	const offset = binaryMessage.type === "action" ? 1 : 0
	leaf.writeUintBE(binaryMessage.payload.timestamp * 2 + offset, 0, 6)
	hash.copy(leaf, 6, 0, 8)
	mst.insert(leaf, hash)
}

async function testSync(sourceMessages: Message[], targetMessages: Message[]): Promise<Message[]> {
	const directory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)
	const sourceMessageStore = new MessageStore(uri, path.resolve(directory, "source.sqlite"))
	const sourceMST = new okra.Tree(path.resolve(directory, "source.okra"))
	const targetMST = new okra.Tree(path.resolve(directory, "target.okra"))

	for (const message of sourceMessages) {
		const [hash, binaryMessage] = normalizeMessage(message)
		insert(sourceMST, hash, binaryMessage)
		sourceMessageStore.insert(hash, binaryMessage)
	}

	for (const message of targetMessages) {
		const [hash, binaryMessage] = normalizeMessage(message)
		insert(targetMST, hash, binaryMessage)
	}

	const messages: Message[] = []
	async function handleMessage(hash: Buffer, data: Uint8Array, message: BinaryMessage) {
		if (message.type === "action") {
			messages.push(fromBinaryAction(message))
		} else {
			messages.push(fromBinarySession(message))
		}
	}

	try {
		const [source, target] = connect()
		await Promise.all([
			handleIncomingStream(source, sourceMessageStore, sourceMST),
			sync(targetMST, target, handleMessage),
		])

		return messages
	} catch (err) {
		throw err
	} finally {
		targetMST.close()
		sourceMST.close()
		sourceMessageStore.close()
		fs.rmSync(directory, { recursive: true })
	}
}

const signer = new TestSigner(uri)

test("sync two MSTs", async (t) => {
	const a = await signer.sign("log", { message: "a" })
	const b = await signer.sign("log", { message: "b" })
	const c = await signer.sign("log", { message: "c" })
	const d = await signer.sign("log", { message: "d" })
	const e = await signer.sign("log", { message: "e" })
	const f = await signer.sign("log", { message: "f" })

	const delta = await testSync([a, b, c, d, f], [a, d, e, f])
	t.deepEqual(delta, [b, c])
})
