import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import stream from "node:stream"

import { sha256 } from "@noble/hashes/sha256"

import test from "ava"

import { nanoid } from "nanoid"
import toIterable from "stream-to-it"

import type { Duplex, Source } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import type { Message } from "@canvas-js/interfaces"

import { openMessageStore } from "@canvas-js/core/components/messageStore"
import { stringify } from "@canvas-js/core/utils"
import { handleIncomingStream, sync } from "@canvas-js/core/sync"

import { TestSigner, compileSpec, collect, map } from "./utils.js"

const { app, cid } = await compileSpec({
	models: {},
	actions: { log: ({ message }, {}) => console.log(message) },
})

// creates an in-memory bi-directional connection
function connect(): [
	source: Duplex<Source<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>>,
	target: Duplex<Source<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>>
] {
	const source = toIterable.duplex<Source<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>>(
		new stream.PassThrough()
	)
	const target = toIterable.duplex<Source<Uint8ArrayList>, Source<Uint8ArrayList | Uint8Array>>(
		new stream.PassThrough()
	)

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

	const [sourceMessageStore, targetMessageStore] = await Promise.all([
		openMessageStore(app, sourceDirectory),
		openMessageStore(app, targetDirectory),
	])

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

	try {
		const [source, target] = connect()
		return await targetMessageStore.write(async (targetTxn) => {
			return await sourceMessageStore.read(async (sourceTxn) => {
				const [_, delta] = await Promise.all([
					handleIncomingStream(cid, sourceTxn, source),
					collect(map(sync(cid, targetTxn, target), ([_, message]) => message)),
				])

				return delta
			})
		})
	} finally {
		await sourceMessageStore.close()
		await targetMessageStore.close()
		fs.rmSync(sourceDirectory, { recursive: true })
		fs.rmSync(targetDirectory, { recursive: true })
	}
}

const signer = new TestSigner(app)

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

test("sync from empty source", async (t) => {
	const a = await signer.sign("log", { message: "a" })
	const b = await signer.sign("log", { message: "b" })
	const c = await signer.sign("log", { message: "c" })

	const delta = await testSync([], [a, b, c])
	t.deepEqual(delta, [])
})

test("sync into empty target", async (t) => {
	const a = await signer.sign("log", { message: "a" })
	const b = await signer.sign("log", { message: "b" })
	const c = await signer.sign("log", { message: "c" })

	const delta = await testSync([a, b, c], [])
	t.deepEqual(delta, [a, b, c])
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
