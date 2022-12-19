import assert from "node:assert"

import chalk from "chalk"
import { ethers } from "ethers"

import { BlockResolver, CacheMap } from "./utils.js"
import * as constants from "./constants.js"
import { Block, ChainId } from "@canvas-js/interfaces"

export const ethersBlockToCanvasBlock = (chainId: ChainId, ethBlock: ethers.providers.Block): Block => {
	return {
		chain: "eth",
		chainId,
		blocknum: ethBlock.number,
		blockhash: ethBlock.hash,
		timestamp: ethBlock.timestamp,
	}
}

export class BlockCache {
	private readonly controller = new AbortController()
	private readonly caches: Record<string, CacheMap<string, ethers.providers.Block>> = {}
	private latestBlockHash: Record<string, string> = {}

	constructor(private readonly providers: Record<string, ethers.providers.Provider>) {
		for (const [key, provider] of Object.entries(providers)) {
			this.caches[key] = new CacheMap(constants.BLOCK_CACHE_SIZE)
			const handleBlock = async (blocknum: number) => {
				const block = await this.providers[key].getBlock(blocknum)
				this.caches[key].add(block.hash, block)
				this.latestBlockHash[key] = block.hash
			}

			provider.on("block", handleBlock)
			this.controller.signal.addEventListener("abort", () => {
				provider.removeListener("block", handleBlock)
				this.caches[key].clear()
			})
		}
	}

	public close() {
		this.controller.abort()
	}

	public getBlock: BlockResolver = async (chain, chainId, blockhash) => {
		const key = `${chain}:${chainId}`
		const provider = this.providers[key]
		const cache = this.caches[key]
		assert(provider !== undefined && cache !== undefined, `No provider for ${chain}:${chainId}`)

		blockhash = blockhash.toLowerCase()

		if (blockhash == "latest") {
			if (this.latestBlockHash[key]) {
				blockhash = this.latestBlockHash[key]
			} else {
				throw Error("No latest block exists yet")
			}
		}

		let block = cache.get(blockhash)
		if (block === undefined) {
			try {
				block = await provider.getBlock(blockhash)
			} catch (err) {
				// TODO: catch rpc errors and identify those separately vs invalid blockhash errors
				console.log(chalk.red("Failed to fetch block from RPC provider"))
				throw err
			}

			cache.add(block.hash.toLowerCase(), block)
		}

		return ethersBlockToCanvasBlock(chainId, block)
	}
}
