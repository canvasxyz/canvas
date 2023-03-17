import os from "node:os"
import fs from "node:fs"
import path from "node:path"
import stream from "node:stream"
import { v4 as uuidv4 } from "uuid"
import { sha256 } from "@noble/hashes/sha256"

import test from "ava"

import { nanoid } from "nanoid"
import toIterable from "stream-to-it"

import type { Duplex } from "it-stream-types"
import type { Uint8ArrayList } from "uint8arraylist"

import type { Action, Message } from "@canvas-js/interfaces"

import { openMessageStore } from "@canvas-js/core/components/messageStore"
import { stringify } from "@canvas-js/core/utils"
import { handleIncomingStream, sync } from "@canvas-js/core/sync"

import { TestSigner, compileSpec } from "./utils.js"

const { app, cid, appName } = await compileSpec({
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
					handleIncomingStream(cid, source, sourceTxn),
					sync(target, targetTxn, async (txn, hash, data, message) => void delta.push(message)),
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
console.log(process.env.ENABLE_SYNC_BENCHMARK)
if (process.env.ENABLE_SYNC_BENCHMARK) {
	test("test a really large sync", async (t) => {
		const sourceMessages: Action[] = []
		for (var i = 0; i < 20; i++) {
			sourceMessages.push(await signer.sign("log", { message: uuidv4() }))
		}

		const targetMessages: Action[] = []
		for (var i = 0; i < 0; i++) {
			targetMessages.push(await signer.sign("log", { message: uuidv4() }))
		}

		const startTime = new Date()
		await testSync(sourceMessages, targetMessages)
		const endTime = new Date()
		// @ts-ignore
		const timeDiffMs = endTime - startTime
		const timeDiffS = timeDiffMs / 1000
		console.log(timeDiffS)

		t.pass()
	})
}
