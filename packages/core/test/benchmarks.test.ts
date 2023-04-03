import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test from "ava"

import chalk from "chalk"
import { nanoid } from "nanoid"

import { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId, exportToProtobuf } from "@libp2p/peer-id-factory"

import { UpdateEventDetail } from "@canvas-js/interfaces"
import { Core } from "@canvas-js/core"
import { PEER_ID_FILENAME } from "@canvas-js/core/constants"

import { compileSpec, TestSigner } from "./utils.js"

const { app, appName, spec } = await compileSpec({
	name: "Test App",
	models: {},
	actions: { log: ({ message }, {}) => {} },
})

const signer = new TestSigner(app, appName)

const log = (message: string) => console.log(chalk.blueBright(`[benchmark] ${message}`))

async function initializeTestCores(parentDirectory: string, ports: number[]): Promise<Core[]> {
	const peerIds = await Promise.all(ports.map(() => createEd25519PeerId()))
	const bootstrapAddresses = ports.map((port, i) => `/ip4/127.0.0.1/tcp/${port}/ws/p2p/${peerIds[i]}`)

	return Promise.all(
		ports.map((port, i) => {
			const peerId = peerIds[i]
			const directory = path.resolve(parentDirectory, nanoid())
			fs.mkdirSync(directory)
			fs.writeFileSync(path.resolve(directory, PEER_ID_FILENAME), exportToProtobuf(peerId))

			const bootstrapList = bootstrapAddresses.filter((_, j) => j !== i)
			return Core.initialize({
				directory,
				spec,
				listen: [`/ip4/127.0.0.1/tcp/${port}/ws`],
				announce: [`/ip4/127.0.0.1/tcp/${port}/ws/p2p/${peerId}`],
				bootstrapList,
			})
		})
	)
}

function connect(core: Core, id: PeerId | undefined, app: string): Promise<void> {
	return new Promise((resolve, reject) => {
		core.libp2p?.pubsub.addEventListener("subscription-change", ({ detail: { peerId, subscriptions } }) => {
			if (id?.equals(peerId)) {
				for (const { subscribe, topic } of subscriptions) {
					if (subscribe && topic === app) {
						return resolve()
					}
				}
			}
		})
	})
}

async function waitForMerkleRoot(core: Core, uri: string, merkleRoot: string) {
	const merkleRoots = core.messageStore.getMerkleRoots()
	if (merkleRoots[uri] === merkleRoot) {
		return
	}

	await new Promise<void>((resolve, reject) => {
		const listener = ({ detail: { uri, root } }: CustomEvent<UpdateEventDetail>) => {
			if (uri === app && root === merkleRoot) {
				core.removeEventListener("update", listener)
				resolve()
			}
		}

		core.addEventListener("update", listener)
	})
}

// AVA requires that all test files have at least one test
test("no-op", (t) => t.pass())

if (process.env["RUN_BENCHMARKS"]) {
	test("time sending an action", async (t) => {
		t.timeout(50000)

		const nInitial = 1000

		const parentDirectory = path.resolve(os.tmpdir(), nanoid())
		log(`creating tmp directory ${parentDirectory}`)
		fs.mkdirSync(parentDirectory)

		t.teardown(() => {
			log(`removing tmp directory ${parentDirectory}`)
			fs.rmSync(parentDirectory, { recursive: true })
		})

		const [source, target] = await initializeTestCores(parentDirectory, [8001, 8002])
		log(`source: ${source.libp2p?.peerId}`)
		log(`target: ${target.libp2p?.peerId}`)

		log("waiting for peers to find each other...")

		await Promise.all([connect(source, target.libp2p?.peerId, app), connect(target, source.libp2p?.peerId, app)])

		log("peers connected")

		// Generate a first batch of messages
		log("sending and executing a first batch of messages")
		const initialSyncStart = performance.now()

		const messages = await Promise.all(
			[...Array(nInitial).keys()].map((i) => signer.sign("log", { message: i.toString() }))
		)

		log(`generating ${nInitial} messages: ${(performance.now() - initialSyncStart) / 1000} seconds`)

		// Send messages (synchronous for now)
		const sent = new Set<string>()
		for (const message of messages) {
			try {
				const { hash } = await source.apply(message)
				sent.add(hash)
			} catch (err) {
				log(`error: ${err}`)
			}
		}

		log(`applying ${nInitial} messages on source: ${(performance.now() - initialSyncStart) / 1000} seconds`)

		const { [app]: sourceMerkleRoot } = source.messageStore.getMerkleRoots()

		await waitForMerkleRoot(target, app, sourceMerkleRoot)

		log(`received ${nInitial} messages: ${(performance.now() - initialSyncStart) / 1000} seconds`)

		const timings: number[] = []

		// Send a second batch of messages, and wait for nodes to sync
		// TODO: make asynchronous
		log("sending and awaiting 100 messages one-by-one")
		for (let i = 0; i < 100; i++) {
			const actionStart = performance.now()
			const action = await signer.sign("log", { message: "a2" })
			await source.apply(action)
			const { [app]: sourceMerkleRoot } = source.messageStore.getMerkleRoots()
			await waitForMerkleRoot(target, app, sourceMerkleRoot)
			const actionTimeSeconds = (performance.now() - actionStart) / 1000
			timings.push(actionTimeSeconds)
		}

		const mean = timings.reduce((x, y) => x + y, 0) / timings.length
		log(`average latency: ${mean.toFixed(3)}s`)

		t.pass()

		await source.close()
		await target.close()
	})
}
