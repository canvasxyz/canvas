import os from "node:os"
import fs from "node:fs"
import path from "node:path"

import test from "ava"

import { sha256 } from "@noble/hashes/sha256"

import { createEd25519PeerId, exportToProtobuf } from "@libp2p/peer-id-factory"

import { nanoid } from "nanoid"

import { Core } from "@canvas-js/core"
import { PEER_ID_FILENAME } from "@canvas-js/core/constants"
import { assert, toHex } from "@canvas-js/core/utils"

import { compileSpec, TestSigner } from "./utils.js"
import { serializeAction } from "@canvas-js/interfaces"

const { app, appName, spec } = await compileSpec({
	name: "Test App",
	models: {},
	actions: { log: ({ message }, {}) => console.log(message) },
})

const signer = new TestSigner(app, appName)

test("hi", async (t) => {
	t.timeout(30000)

	const sourceDirectory = path.resolve(os.tmpdir(), nanoid())
	const targetDirectory = path.resolve(os.tmpdir(), nanoid())

	fs.mkdirSync(sourceDirectory)
	fs.mkdirSync(targetDirectory)

	const sourcePeerId = await createEd25519PeerId()
	const targetPeerId = await createEd25519PeerId()

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
				verbose: true,
			}),
			Core.initialize({
				directory: targetDirectory,
				spec,
				listen: 8002,
				bootstrapList: [`/ip4/127.0.0.1/tcp/8001/ws/p2p/${sourcePeerId}`],
				announce: [`/ip4/127.0.0.1/tcp/8002/ws/p2p/${targetPeerId}`],
				verbose: true,
			}),
		])

		const a = await signer.sign("log", { message: "a" })
		const { hash: sourceHash } = await source.apply(a)

		await new Promise<void>((resolve, reject) => {
			target.addEventListener("message", ({ detail: message }) => {
				assert(message.type === "action")
				t.is(toHex(sha256(serializeAction(message))), sourceHash)
				resolve()
			})
		})

		await source.close()
		await target.close()
	} finally {
		fs.rmSync(sourceDirectory, { recursive: true })
		fs.rmSync(targetDirectory, { recursive: true })
	}
})
