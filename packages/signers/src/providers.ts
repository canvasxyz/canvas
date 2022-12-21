import { ethers } from "ethers"
import { StargateClient } from "@cosmjs/stargate"
import { Tendermint34Client, NewBlockHeaderEvent } from "@cosmjs/tendermint-rpc"
import { Block, BlockProvider, Chain, ChainId } from "@canvas-js/interfaces"
import { Listener, Stream } from "xstream"

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

	tmClient?: Tendermint34Client
	stream?: Stream<NewBlockHeaderEvent>
	blockListener?: any

	constructor(chainId: ChainId, url: string) {
		this.chainId = chainId
		this.url = url
	}

	async getBlock({ blocknum }: { blocknum?: number }) {
		if (!blocknum) {
			console.log("No key given for `getBlock`, CosmosBlockProvider requires a blocknum")
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
		if (this.tmClient || this.stream || this.blockListener) {
			// stream and/or blockListener already exists, abort
			console.log(`tmClient already exists on CosmosBlockProvider, cannot create a new block subscription`)
		}
		this.tmClient = await Tendermint34Client.connect(this.url)
		this.stream = this.tmClient.subscribeNewBlockHeader()

		this.blockListener = {
			next: async (e) => {
				const block = await this.getBlock({ blocknum: e.height })
				cb(block)
			},
		} as Partial<Listener<NewBlockHeaderEvent>>

		this.stream.addListener(this.blockListener)
	}

	removeOnBlock() {
		if (this.stream && this.blockListener) {
			this.stream.removeListener(this.blockListener)
			this.tmClient?.disconnect()
			this.tmClient = undefined
			this.stream = undefined
			this.blockListener = undefined
		}
	}
}
