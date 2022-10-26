import path from "node:path"
import fs from "node:fs"

import { ethers } from "ethers"
import chalk from "chalk"
import PQueue from "p-queue"

import type { PeerId } from "@libp2p/interface-peer-id"
import { createEd25519PeerId, exportToProtobuf, createFromProtobuf } from "@libp2p/peer-id-factory"
import { createLibp2p, Libp2p } from "libp2p"
import Hash from "ipfs-only-hash"
import { CID } from "multiformats/cid"

import type { Chain, ChainId } from "@canvas-js/interfaces"

import { Core } from "./core.js"
import { getLibp2pInit } from "./libp2p.js"
import { BlockCache } from "./utils.js"
import * as constants from "./constants.js"

const ipfsURIPattern = /^ipfs:\/\/([a-zA-Z0-9]+)$/
const fileURIPattern = /^file:\/\/(.+)$/

export interface DriverConfig {
	rootDirectory: string | null
	port?: number
	rpc?: Partial<Record<Chain, Record<ChainId, string>>>
}

export class Driver {
	public static async initialize({ rootDirectory, port, rpc }: DriverConfig) {
		let peerId: PeerId | null = null
		let libp2p: Libp2p | null = null
		if (rootDirectory !== null) {
			const peerIdPath = path.resolve(rootDirectory, "peer.id")

			if (fs.existsSync(peerIdPath)) {
				peerId = await createFromProtobuf(fs.readFileSync(peerIdPath))
			} else {
				peerId = await createEd25519PeerId()
				fs.writeFileSync(peerIdPath, exportToProtobuf(peerId))
			}

			console.log(`[canvas-core] PeerId ${peerId.toString()}`)

			libp2p = await createLibp2p(getLibp2pInit(peerId, port))
			await libp2p.start()
		}

		// console.log()

		const providers: Record<string, ethers.providers.JsonRpcProvider> = {}
		for (const [chain, chainIds] of Object.entries(rpc || {})) {
			for (const [chainId, url] of Object.entries(chainIds)) {
				const key = `${chain}:${chainId}`
				providers[key] = new ethers.providers.JsonRpcProvider(url)
			}
		}

		return new Driver(rootDirectory, libp2p, providers)
	}

	public readonly cores: Record<string, Core> = {}

	private readonly queue = new PQueue({ concurrency: 1 })
	private readonly controller = new AbortController()
	private readonly blockCache: BlockCache

	private constructor(
		public readonly rootDirectory: string | null,
		public readonly libp2p: Libp2p | null,
		public readonly providers: Record<string, ethers.providers.JsonRpcProvider>
	) {
		this.blockCache = new BlockCache(this.providers)
	}

	async close() {
		this.controller.abort()
		this.blockCache.close()
		for (const key of Object.keys(this.cores)) {
			await this.stop(key)
		}

		if (this.libp2p !== null) {
			await this.libp2p.stop()
		}
	}

	public start(
		uri: string,
		options: { unchecked?: boolean; verbose?: boolean; offline?: boolean } = {}
	): Promise<Core> {
		return this.queue.add(async () => {
			const ipfsURI = ipfsURIPattern.exec(uri)
			const fileURI = fileURIPattern.exec(uri)

			let directory: string | null = null
			let spec: string
			if (ipfsURI !== null) {
				if (this.rootDirectory === null) {
					throw new Error("cannot run IPFS specs in development mode")
				}

				const [_, cid] = ipfsURI
				directory = path.resolve(this.rootDirectory, cid)
				spec = fs.readFileSync(path.resolve(directory, constants.SPEC_FILENAME), "utf-8")
			} else if (fileURI !== null) {
				const [_, specPath] = fileURI
				spec = fs.readFileSync(specPath, "utf-8")
			} else {
				throw new Error("uri must be a file:// or ipfs:// URI")
			}

			const core = await Core.initialize({
				directory,
				uri,
				spec,
				libp2p: this.libp2p,
				providers: this.providers,
				blockResolver: this.blockCache.getBlock,
				...options,
			})

			this.cores[uri] = core
			core.addEventListener("close", () => {
				delete this.cores[uri]
			})

			return core
		})
	}

	public stop(uri: string): Promise<void> {
		return this.queue.add(async () => {
			const core = this.cores[uri]
			if (core === undefined) {
				throw new Error(`${uri} is not running`)
			}

			await core.close()
			delete this.cores[uri]
		})
	}
}
