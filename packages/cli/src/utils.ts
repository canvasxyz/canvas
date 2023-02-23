import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import process from "node:process"

import type { PeerId } from "@libp2p/interface-peer-id"
import { exportToProtobuf, createFromProtobuf, createEd25519PeerId } from "@libp2p/peer-id-factory"
import Hash from "ipfs-only-hash"
import chalk from "chalk"
import prompts from "prompts"

import { chainType, constants } from "@canvas-js/core"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { ChainImplementation } from "@canvas-js/interfaces"
import { ethers } from "ethers"

export const CANVAS_HOME = process.env.CANVAS_HOME ?? path.resolve(os.homedir(), ".canvas")
export const SOCKET_FILENAME = "daemon.sock"
export const SOCKET_PATH = path.resolve(CANVAS_HOME, SOCKET_FILENAME)

if (!fs.existsSync(CANVAS_HOME)) {
	console.log(`[canvas-cli] Creating directory ${path.resolve(CANVAS_HOME)}`)
	console.log("[canvas-cli] Override this path by setting a CANVAS_HOME environment variable.")
	fs.mkdirSync(CANVAS_HOME)
}

export async function getPeerId(): Promise<PeerId> {
	if (process.env.PEER_ID !== undefined) {
		return createFromProtobuf(Buffer.from(process.env.PEER_ID, "base64"))
	}

	const peerIdPath = path.resolve(CANVAS_HOME, constants.PEER_ID_FILENAME)
	if (fs.existsSync(peerIdPath)) {
		return createFromProtobuf(fs.readFileSync(peerIdPath))
	} else {
		console.log(`[canvas-cli] Creating new PeerID at ${peerIdPath}`)
		const peerId = await createEd25519PeerId()
		fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
		return peerId
	}
}

export async function confirmOrExit(message: string) {
	const { confirm } = await prompts({ type: "confirm", name: "confirm", message: chalk.yellow(message) })

	if (!confirm) {
		console.error("[canvas-cli] Cancelled.")
		process.exit(1)
	}
}

export const cidPattern = /^Qm[a-zA-Z0-9]{44}$/

export function parseSpecArgument(value: string): { directory: string | null; uri: string; spec: string } {
	if (cidPattern.test(value)) {
		const directory = path.resolve(CANVAS_HOME, value)
		const specPath = path.resolve(directory, constants.SPEC_FILENAME)
		if (fs.existsSync(specPath)) {
			const spec = fs.readFileSync(specPath, "utf-8")
			return { directory, uri: `ipfs://${value}`, spec }
		} else {
			console.error(chalk.red(`[canvas-cli] App ${value} is not installed.`))
			process.exit(1)
		}
	} else if (value.endsWith(".js") || value.endsWith(".jsx")) {
		const specPath = path.resolve(value)
		const spec = fs.readFileSync(specPath, "utf-8")
		return { directory: null, uri: `file://${specPath}`, spec }
	} else {
		console.error(chalk.red("[canvas-cli] Spec argument must be a CIDv0 or a path to a local .js/.jsx file"))
		process.exit(1)
	}
}

export async function installSpec(app: string): Promise<string> {
	const cid = await Hash.of(app)
	const directory = path.resolve(CANVAS_HOME, cid)
	if (!fs.existsSync(directory)) {
		console.log(`[canvas-cli] Creating app directory at ${directory}`)
		fs.mkdirSync(directory)
	}

	const specPath = path.resolve(directory, constants.SPEC_FILENAME)
	if (fs.existsSync(specPath)) {
		console.log(`[canvas-cli] ${specPath} already exists`)
	} else {
		console.log(`[canvas-cli] Creating ${specPath}`)
		fs.writeFileSync(specPath, app, "utf-8")
	}

	return cid
}

export function getChainImplementations(args?: (string | number)[]): ChainImplementation[] {
	const chains: ChainImplementation[] = []

	if (args !== undefined) {
		for (let i = 0; i < args.length; i += 3) {
			const [chain, chainId, url] = args.slice(i, i + 3)
			if (!chainType.is(chain)) {
				console.log(chalk.red(`[canvas-cli] Invalid chain "${chain}", should be a ${chainType.name}`))
				process.exit(1)
			} else if (typeof chainId !== "number") {
				console.log(chalk.red(`Invalid chain id "${chainId}", should be e.g. 1`))
				process.exit(1)
			} else if (typeof url !== "string") {
				console.log(chalk.red(`Invalid chain rpc "${url}", should be a url`))
				process.exit(1)
			}

			if (chain == "ethereum") {
				const provider = new ethers.providers.JsonRpcProvider(url)
				chains.push(new EthereumChainImplementation(chainId.toString(), provider))
			} else {
				console.log(`'chain' value (${chain}) was not 'eth', all other RPCs are currently unsupported`)
			}
		}
	} else if (process.env.ETH_CHAIN_ID && process.env.ETH_CHAIN_RPC) {
		const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_CHAIN_RPC)
		chains.push(new EthereumChainImplementation(process.env.ETH_CHAIN_ID, provider))
		console.log(
			`[canvas-cli] Using Ethereum RPC for chain ID ${process.env.ETH_CHAIN_ID}: ${process.env.ETH_CHAIN_RPC}`
		)
	}

	return chains
}

export function getDirectorySize(directory: string): number {
	return fs.readdirSync(directory).reduce((totalSize, name) => {
		const file = path.resolve(directory, name)
		const stat = fs.statSync(file)
		if (stat.isDirectory()) {
			return totalSize + stat.size + getDirectorySize(file)
		} else {
			return totalSize + stat.size
		}
	}, 0)
}
