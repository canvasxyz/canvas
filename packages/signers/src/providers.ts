import { ethers } from "ethers"
import { StargateClient } from "@cosmjs/stargate"
import { Block, BlockProvider, Chain, ChainId } from "@canvas-js/interfaces"

export const ethersBlockToCanvasBlock = (chainId: ChainId, ethBlock: ethers.providers.Block): Block => {
	return {
		chain: "eth",
		chainId,
		blocknum: ethBlock.number,
		blockhash: ethBlock.hash,
		timestamp: ethBlock.timestamp,
	}
}

type BlockCallback = (block: Block) => void

export class EthereumBlockProvider implements BlockProvider {
	chain = "eth" as Chain
	chainId: ChainId
	provider: ethers.providers.Provider
	handler?: ethers.providers.Listener

	constructor(chainId: ChainId, url: string) {
		this.chainId = chainId
		this.provider = new ethers.providers.JsonRpcProvider(url)
	}

	async getBlock({ blockhash, blocknum }: { blockhash?: string; blocknum?: number }) {
		const key = blockhash || blocknum
		if (!key) {
			throw Error("No key given for `getBlock`")
		}
		const ethBlock = await this.provider.getBlock(key)
		return ethersBlockToCanvasBlock(this.chainId, ethBlock)
	}

	onBlock(cb: BlockCallback) {
		this.handler = async (blocknum: number) => {
			cb(await this.getBlock({ blocknum }))
		}

		this.provider.on("block", this.handler)
	}

	removeOnBlock() {
		if (this.handler) {
			this.provider.removeListener("block", this.handler)
		}
	}
}

export class CosmosBlockProvider implements BlockProvider {
	chain = "cosmos" as Chain
	chainId: ChainId
	url: string

	blockTimer?: any

	constructor(chainId: ChainId, url: string) {
		this.chainId = chainId
		this.url = url
	}

	async getBlock({ blocknum }: { blocknum?: number }) {
		if (!blocknum) {
			console.log(`Retrieving latest block for ${this.chain}:${this.chainId}`)
		}
		const client = await StargateClient.connect(this.url)

		const block = await client.getBlock(blocknum)

		return {
			chain: this.chain,
			chainId: this.chainId,
			blocknum: block.header.height,
			blockhash: block.id,
			// seconds since epoch
			timestamp: Math.floor(new Date(block.header.time).getTime() / 1000),
		}
	}

	async onBlock(cb: (block: Block) => void) {
		if (this.blockTimer) {
			console.log("Attempted to set `onBlock` callback, but it has already been set")
			// already polling
			return
		}
		// TODO: Make this configurable for different Cosmos chains?
		const pollingInternalMs = 10000
		this.blockTimer = setInterval(async () => {
			// get the latest block
			const block = await this.getBlock({})
			cb(block)
		}, pollingInternalMs)
	}

	removeOnBlock() {
		if (this.blockTimer) {
			clearInterval(this.blockTimer)
		}
	}
}
