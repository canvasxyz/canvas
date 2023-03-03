import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import stream from "node:stream"

import { sha256 } from "@noble/hashes/sha256"

import test from "ava"

import { nanoid } from "nanoid"
import toIterable from "stream-to-it"

import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import type { Message } from "@canvas-js/interfaces"

import { openMessageStore } from "@canvas-js/core/components/messageStore"
import { stringify } from "@canvas-js/core/utils"
import { handleIncomingStream, sync } from "@canvas-js/core/sync"

import { TestSigner, compileSpec } from "./utils.js"

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
	const sourceDirectory = path.resolve(os.tmpdir(), nanoid())
	const targetDirectory = path.resolve(os.tmpdir(), nanoid())
	fs.mkdirSync(sourceDirectory)
	fs.mkdirSync(targetDirectory)

	const sourceMessageStore = await openMessageStore(app, sourceDirectory)
	const targetMessageStore = await openMessageStore(app, targetDirectory)
	await sourceMessageStore.write(async (txn) => {
		for (const message of sourceMessages) {
			await txn.insertMessage(sha256(stringify(message)), message)
		}
	})
	await targetMessageStore.write(async (txn) => {
		for (const message of targetMessages) {
			await txn.insertMessage(sha256(stringify(message)), message)
		}
	})

	const delta: Message[] = []
	try {
		const [source, target] = connect()
		await targetMessageStore.write(async (targetTxn) => {
			await sourceMessageStore.read(async (sourceTxn) => {
				await Promise.all([
					handleIncomingStream(source, sourceTxn),
					sync(target, targetTxn, async (hash, data, message) => void delta.push(message)),
				])
			})
		})

		return delta
	} finally {
		await sourceMessageStore.close()
		await targetMessageStore.close()
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

// test("sync two big MSTs", async (t) => {
// 	const count = 1000
// 	const index = Math.floor(Math.random() * count)

// 	const messages: Message[] = []
// 	for (let i = 0; i < count; i++) {
// 		messages.push(await signer.sign("log", { message: nanoid() }))
// 	}

// 	function* sourceMessages(): Generator<Message> {
// 		for (const message of messages) yield message
// 	}

// 	function* targetMessages(): Generator<Message> {
// 		for (const [i, message] of messages.entries()) {
// 			if (i === index) {
// 				continue
// 			} else {
// 				yield message
// 			}
// 		}
// 	}

// 	const delta = await testSync(sourceMessages(), targetMessages())
// 	t.deepEqual(delta, [messages[index]])
// })
