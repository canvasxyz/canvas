import { ethers } from "ethers"

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

	async getBlock(key: string | number) {
		const ethBlock = await this.provider.getBlock(key)
		return ethersBlockToCanvasBlock(this.chainId, ethBlock)
	}

	onBlock(cb: BlockCallback) {
		this.handler = async (blocknum: number) => {
			cb(await this.getBlock(blocknum))
		}

		this.provider.on("block", this.handler)
	}

	removeOnBlock() {
		if (this.handler) {
			this.provider.removeListener("block", this.handler)
		}
	}
}
