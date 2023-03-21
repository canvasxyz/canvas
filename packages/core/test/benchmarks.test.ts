import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test from "ava"

import { sha256 } from "@noble/hashes/sha256"

import { createEd25519PeerId, exportToProtobuf } from "@libp2p/peer-id-factory"

import { nanoid } from "nanoid"

import { Core } from "@canvas-js/core"
import { PEER_ID_FILENAME } from "@canvas-js/core/constants"
import { toHex } from "@canvas-js/core/utils"

import { compileSpec, TestSigner } from "./utils.js"
import { Message, serializeAction } from "@canvas-js/interfaces"
import chalk from "chalk"

const waitForMessageWithHash = (core: Core, expectedHash: string) => {
	return new Promise<void>((resolve, reject) => {
		const cb = ({ detail: message }: { detail: Message }) => {
			testLog(`received: ${message}`)
			if (message.type == "action") {
				const messageHash = toHex(sha256(serializeAction(message)))

				if (messageHash == expectedHash) {
					core.removeEventListener("message", cb)
					resolve()
				}
			}
		}
		core.addEventListener("message", cb)
	})
}

class Timer {
	startTime: Date
	endTime: Date | null

	constructor() {
		this.startTime = new Date()
		this.endTime = null
	}

	done() {
		this.endTime = new Date()
	}

	seconds() {
		// @ts-ignore
		const timeDiffMs = this.endTime - this.startTime
		return timeDiffMs / 1000
	}
}

const { app, appName, spec } = await compileSpec({
	name: "Test App",
	models: {},
	actions: { log: ({ message }, {}) => console.log(message) },
})

const signer = new TestSigner(app, appName)

const testLog = (message: string) => {
	console.log(chalk.blueBright(`[test] ${message}`))
}

test("time sending two messages both ways", async (t) => {
	t.timeout(50000)

	const sourceDirectory = path.resolve(os.tmpdir(), nanoid())
	const targetDirectory = path.resolve(os.tmpdir(), nanoid())
	testLog(sourceDirectory)
	testLog(targetDirectory)

	fs.mkdirSync(sourceDirectory)
	fs.mkdirSync(targetDirectory)

	const sourcePeerId = await createEd25519PeerId()
	const targetPeerId = await createEd25519PeerId()

	testLog(`sourcePeerId: ${sourcePeerId}`)
	testLog(`targetPeerId: ${targetPeerId}`)

	fs.writeFileSync(path.resolve(sourceDirectory, PEER_ID_FILENAME), exportToProtobuf(sourcePeerId))
	fs.writeFileSync(path.resolve(targetDirectory, PEER_ID_FILENAME), exportToProtobuf(targetPeerId))

	try {
		const [source, target] = await Promise.all([
			Core.initialize({
				directory: sourceDirectory,
				spec,
				listen: 8001,
				bootstrapList: [`/ip4/127.0.0.1/tcp/8002/ws/p2p/${targetPeerId}`],
				announce: [`/ip4/127.0.0.1/tcp/8001/ws/p2p/${sourcePeerId}`],
				// verbose: true,
			}),
			Core.initialize({
				directory: targetDirectory,
				spec,
				listen: 8002,
				bootstrapList: [`/ip4/127.0.0.1/tcp/8001/ws/p2p/${sourcePeerId}`],
				announce: [`/ip4/127.0.0.1/tcp/8002/ws/p2p/${targetPeerId}`],
				// verbose: true,
			}),
		])

		const actionTimer = new Timer()
		const a = await signer.sign("log", { message: "a" })
		const { hash: sourceHash } = await source.apply(a)
		testLog(`sourceHash: ${sourceHash}`)

		const b = await signer.sign("log", { message: "b" })
		const { hash: targetHash } = await target.apply(b)
		testLog(`targetHash: ${targetHash}`)

		await Promise.all([waitForMessageWithHash(target, sourceHash), waitForMessageWithHash(source, targetHash)])
		actionTimer.done()
		testLog(`initial sync and message send took ${actionTimer.seconds()} seconds`)

		const timings: number[] = []

		for (let i = 0; i < 20; i++) {
			testLog(`test run: ${i}`)
			const actionTimer2 = new Timer()
			const a2 = await signer.sign("log", { message: "a2" })
			const { hash: sourceHash2 } = await source.apply(a2)
			testLog(`sourceHash: ${sourceHash2}`)

			const b2 = await signer.sign("log", { message: "b2" })
			const { hash: targetHash2 } = await target.apply(b2)
			testLog(`targetHash: ${targetHash2}`)

			await Promise.all([waitForMessageWithHash(target, sourceHash2), waitForMessageWithHash(source, targetHash2)])
			actionTimer2.done()
			testLog(`sync and message send took ${actionTimer2.seconds()} seconds`)
			timings.push(actionTimer2.seconds())
		}

		testLog("timings for sending messages both ways:")
		testLog(`${timings}`)
		const mean = timings.reduce((x, y) => x + y, 0) / timings.length
		testLog(`average: ${mean.toFixed(3)}`)
		t.pass()

		await source.close()
		await target.close()
	} finally {
		fs.rmSync(sourceDirectory, { recursive: true })
		fs.rmSync(targetDirectory, { recursive: true })
	}
})
