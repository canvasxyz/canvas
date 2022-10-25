import fs from "node:fs"
import path from "node:path"

import yargs from "yargs"
import chalk from "chalk"
import Hash from "ipfs-only-hash"

import type { PeerId } from "@libp2p/interface-peer-id"
import type { Multiaddr } from "@multiformats/multiaddr"
import { createLibp2p, Libp2pOptions } from "libp2p"
import { webSockets } from "@libp2p/websockets"
import { noise } from "@chainsafe/libp2p-noise"
import { mplex } from "@libp2p/mplex"
import { bootstrap } from "@libp2p/bootstrap"
import { kadDHT } from "@libp2p/kad-dht"
import { isLoopback } from "@libp2p/utils/multiaddr/is-loopback"
import { isPrivate } from "@libp2p/utils/multiaddr/is-private"
import { createFromProtobuf } from "@libp2p/peer-id-factory"

import { constants } from "@canvas-js/core"
import { retry } from "@canvas-js/core/lib/utils.js"

import { CANVAS_HOME, cidPattern } from "../utils.js"
import { CID } from "multiformats"

export const command = "install <spec>"
export const desc = "Install a spec in the canvas home directory"

export const builder = (yargs: yargs.Argv) =>
	yargs.positional("spec", {
		describe: "Path to spec file, or IPFS hash of spec",
		type: "string",
		demandOption: true,
	})

type Args = ReturnType<typeof builder> extends yargs.Argv<infer T> ? T : never

export async function handler(args: Args) {
	let runCommand
	if (cidPattern.test(args.spec)) {
		const specPath = path.resolve(CANVAS_HOME, args.spec, constants.SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			console.log(chalk.yellow(`[canvas-cli] ${specPath} already exists`))
			return
		}

		// Oooookay now we have to initialize a libp2p node :/
		const peerIdPath = path.resolve(CANVAS_HOME, constants.PEER_ID_FILENAME)
		const peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
		const libp2p = await createLibp2p(getLibp2pInit(peerId))
		await libp2p.start()

		const controller = new AbortController()
		process.on("SIGINT", () => {
			controller.abort()
			libp2p.stop()
		})

		const cid = CID.parse(args.spec)
		const spec = await retry(
			async (signal) => {
				for await (const { id } of libp2p.contentRouting.findProviders(cid)) {
					console.log(chalk.yellow(`[canvas-cli] Trying to fetch ${cid.toString} from ${id.toString()}`))
					const value = await libp2p.fetch(id, `ipfs://${cid.toString()}/`, { signal })
					if (value !== null) {
						const hash = await Hash.of(value)
						if (hash === args.spec) {
							console.log(chalk.yellow(`[canvas-cli] Success!`))
							return value
						}
					}
				}

				throw new Error("No peers found")
			},
			(err, n) => console.log(chalk.red(`[canvas-cli] Failed to fetch spec. Trying again in 1s.`)),
			{ signal: controller.signal, delay: 1000 }
		)

		console.log(chalk.yellow(`[canvas-cli] Creating ${specPath}`))
		fs.writeFileSync(specPath, spec)
		runCommand = `canvas run ${cid.toString()}`
	} else {
		const spec = fs.readFileSync(args.spec, "utf-8")
		const cid = await Hash.of(spec)
		const directory = path.resolve(CANVAS_HOME, cid)
		if (!fs.existsSync(directory)) {
			console.log(chalk.yellow(`[canvas-cli] Creating directory ${directory}`))
			fs.mkdirSync(directory)
		}

		const specPath = path.resolve(directory, constants.SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			console.log(chalk.yellow(`[canvas-cli] ${specPath} already exists`))
		} else {
			console.log(chalk.yellow(`[canvas-cli] Creating ${specPath}`))
			fs.writeFileSync(specPath, spec, "utf-8")
		}

		runCommand = `canvas run ${cid}`
	}

	console.log(chalk.yellow(`[canvas-cli] You can run the app with ${chalk.bold(runCommand)}`))
}

const bootstrapList = [
	"/ip4/137.66.12.223/tcp/4002/ws/p2p/12D3KooWP4DLJuVUKoThfzYugv8c326MuM2Tx38ybvEyDjLQkE2o",
	"/ip4/137.66.11.73/tcp/4002/ws/p2p/12D3KooWRftkCBMtYou4pM3VKdqkKVDAsWXnc8NabUNzx7gp7cPT",
	"/ip4/137.66.27.235/tcp/4002/ws/p2p/12D3KooWPopNdRnzswSd8oVxrUBKGhgKzkYALETK7EHkToy7DKk3",
]

function getLibp2pInit(peerId: PeerId): Libp2pOptions {
	return {
		connectionGater: {
			denyDialMultiaddr: async (peerId: PeerId, multiaddr: Multiaddr) => isLoopback(multiaddr) || isPrivate(multiaddr),
		},
		addresses: {
			announce: bootstrapList.map((multiaddr) => `${multiaddr}/p2p-circuit/p2p/${peerId.toString()}`),
		},
		transports: [webSockets()],
		connectionEncryption: [noise()],
		streamMuxers: [mplex()],
		peerDiscovery: [bootstrap({ list: bootstrapList })],
		dht: kadDHT({ protocolPrefix: "/canvas", clientMode: true }),
	}
}
