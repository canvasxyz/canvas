import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import stream from "node:stream"
import { createHash } from "node:crypto"

import test from "ava"

import { nanoid } from "nanoid"
import toIterable from "stream-to-it"
import * as okra from "node-okra"

import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import type { Message } from "@canvas-js/interfaces"

import { MessageStore } from "@canvas-js/core/lib/messageStore.js"
import { compileSpec, stringify } from "@canvas-js/core/lib/utils.js"
import { getMessageKey, handleIncomingStream, sync } from "@canvas-js/core/lib/rpc/index.js"

import { TestSigner } from "./utils.js"

const { app, appName } = await compileSpec({
	name: "Test App",
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

function initialize(messageStore: MessageStore, mst: okra.Tree, messages: Iterable<Message>) {
	const txn = new okra.Transaction(mst, { readOnly: false })
	try {
		for (const message of messages) {
			const data = Buffer.from(stringify(message))
			const hash = createHash("sha256").update(data).digest()
			txn.set(getMessageKey(hash, message), hash)
			messageStore.insert(hash, message)
		}
		txn.commit()
	} catch (err) {
		txn.abort()
		throw err
	}
}

async function testSync(sourceMessages: Iterable<Message>, targetMessages: Iterable<Message>): Promise<Message[]> {
	const sourceDirectory = path.resolve(os.tmpdir(), nanoid())
	const targetDirectory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(sourceDirectory)
	fs.mkdirSync(targetDirectory)

	const sourceMessageStore = new MessageStore(app, sourceDirectory)
	const targetMessageStore = new MessageStore(app, targetDirectory)
	const [sourceMSTPath, targetMSTPath] = [path.resolve(sourceDirectory, "mst"), path.resolve(targetDirectory, "mst")]
	fs.mkdirSync(sourceMSTPath)
	fs.mkdirSync(targetMSTPath)
	const sourceMST = new okra.Tree(sourceMSTPath)
	const targetMST = new okra.Tree(targetMSTPath)

	initialize(sourceMessageStore, sourceMST, sourceMessages)
	initialize(targetMessageStore, targetMST, targetMessages)

	const delta: Message[] = []
	try {
		const [source, target] = connect()
		const sourceTxn = new okra.Transaction(sourceMST, { readOnly: true })
		const targetTxn = new okra.Transaction(targetMST, { readOnly: false })

		await Promise.all([
			handleIncomingStream(source, sourceMessageStore, sourceTxn),
			sync(targetMessageStore, targetTxn, target, async (hash, data, message) => void delta.push(message)),
		])

		sourceTxn.abort()
		targetTxn.commit()

		return delta
	} finally {
		targetMST.close()
		sourceMST.close()
		sourceMessageStore.close()
		targetMessageStore.close()
		fs.rmSync(sourceDirectory, { recursive: true })
		fs.rmSync(targetDirectory, { recursive: true })
	}
}

const signer = new TestSigner(app, appName)

test("sync two tiny MSTs", async (t) => {
	const a = await signer.sign("log", { message: "a" })
	const b = await signer.sign("log", { message: "b" })
	const c = await signer.sign("log", { message: "c" })
	const d = await signer.sign("log", { message: "d" })
	const e = await signer.sign("log", { message: "e" })
	const f = await signer.sign("log", { message: "f" })

	const delta = await testSync([a, b, c, d, f], [a, d, e, f])
	t.deepEqual(delta, [b, c])
})

test("sync two big MSTs", async (t) => {
	const count = 1000
	const index = Math.floor(Math.random() * count)

	const messages: Message[] = []
	for (let i = 0; i < count; i++) {
		messages.push(await signer.sign("log", { message: nanoid() }))
	}

	function* sourceMessages(): Generator<Message> {
		for (const message of messages) yield message
	}

	function* targetMessages(): Generator<Message> {
		for (const [i, message] of messages.entries()) {
			if (i === index) {
				continue
			} else {
				yield message
			}
		}
	}

	const delta = await testSync(sourceMessages(), targetMessages())
	t.deepEqual(delta, [messages[index]])
})
