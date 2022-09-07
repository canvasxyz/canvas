import type { Block } from "@canvas-js/interfaces"
import { ethers } from "ethers"

export async function getCurrentBlock(provider: ethers.providers.JsonRpcProvider): Promise<Block> {
	const currentBlockNumber = await provider.getBlockNumber()
	const { hash, timestamp, number } = await provider.getBlock(currentBlockNumber)
	return {
		chain: "eth",
		chainId: 1,
		blocknum: number,
		blockhash: hash,
		timestamp: timestamp,
	}
}
