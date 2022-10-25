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
import { VM } from "./vm/index.js"
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
				const [_, cid] = ipfsURI
				spec = await this.fetch(CID.parse(cid))
				if (this.rootDirectory !== null) {
					directory = path.resolve(this.rootDirectory, cid)
				}
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

	public async fetch(cid: CID): Promise<string> {
		if (this.rootDirectory !== null) {
			const directory = path.resolve(this.rootDirectory, cid.toString())
			const specPath = path.resolve(directory, constants.SPEC_FILENAME)
			if (fs.existsSync(specPath)) {
				return fs.readFileSync(specPath, "utf-8")
			}
		}

		if (this.libp2p === null) {
			throw new Error("cannot fetch spec because the driver is offline")
		}

		const { signal } = this.controller

		for await (const { id } of this.libp2p.contentRouting.findProviders(cid, { signal })) {
			let data: Uint8Array | null = null
			try {
				data = await this.libp2p.fetch(id, `ipfs://${cid.toString()}/`)
			} catch (err) {
				console.log(chalk.red(`[canvas-core] Failed to fetch spec from ${id.toString()}`))
			} finally {
				if (data === null) {
					continue
				}
			}

			const hash = await Hash.of(data)
			if (hash === cid.toString()) {
				return Buffer.from(data).toString("utf-8")
			}
		}

		throw new Error("failed to fetch spec from libp2p")
	}
}
