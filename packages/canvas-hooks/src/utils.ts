import { ethers } from "ethers"
import { ActionArgument, Block } from "@canvas-js/interfaces"

export const CANVAS_SESSION_KEY = "CANVAS_SESSION"

export type Dispatch = (call: string, ...args: ActionArgument[]) => Promise<{ hash: string }>

export async function getLatestBlock(provider: ethers.providers.Provider): Promise<Block> {
	const [network, providerBlock] = await Promise.all([provider.getNetwork(), provider.getBlock("latest")])

	return {
		chain: "eth",
		chainId: network.chainId,
		blocknum: providerBlock.number,
		blockhash: providerBlock.hash,
		timestamp: providerBlock.timestamp,
	}
}
