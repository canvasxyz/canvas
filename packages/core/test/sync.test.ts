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

async function testSync(sourceMessages: Iterable<Message>, targetMessages: Iterable<Message>): Promise<Message[]> {
	const directory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(directory)
	const sourceMessageStore = new MessageStore(app, path.resolve(directory, "source.sqlite"))
	const targetMessageStore = new MessageStore(app, path.resolve(directory, "target.sqlite"))
	const sourceMST = new okra.Tree(path.resolve(directory, "source.okra"))
	const targetMST = new okra.Tree(path.resolve(directory, "target.okra"))

	const sourceTxn = new okra.Transaction(sourceMST, { readOnly: false })
	try {
		for (const message of sourceMessages) {
			const data = Buffer.from(stringify(message))
			const hash = createHash("sha256").update(data).digest()
			sourceTxn.set(getMessageKey(hash, message), hash)
			sourceMessageStore.insert(hash, message)
		}
		sourceTxn.commit()
	} catch (err) {
		sourceTxn.abort()
		throw err
	}

	const targetTxn = new okra.Transaction(targetMST, { readOnly: false })
	try {
		for (const message of targetMessages) {
			const data = Buffer.from(stringify(message))
			const hash = createHash("sha256").update(data).digest()
			targetTxn.set(getMessageKey(hash, message), hash)
			targetMessageStore.insert(hash, message)
		}
		targetTxn.commit()
	} catch (err) {
		targetTxn.abort()
		throw err
	}

	const messages: Message[] = []

	try {
		const [source, target] = connect()
		await Promise.all([
			handleIncomingStream(source, sourceMessageStore, sourceMST),
			sync(targetMessageStore, targetMST, target, async (hash, data, message) => void messages.push(message)),
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
	const needle = await signer.sign("log", { message: nanoid() })

	const messages: Message[] = []
	for (let i = 0; i < 1000; i++) {
		messages.push(await signer.sign("log", { message: nanoid() }))
	}

	function* sourceMessages(): Generator<Message> {
		for (const message of messages) yield message
		yield needle
	}

	function* targetMessages(): Generator<Message> {
		for (const message of messages) yield message
	}

	const delta = await testSync(sourceMessages(), targetMessages())
	t.deepEqual(delta, [needle])
})
