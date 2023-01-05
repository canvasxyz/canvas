import { Chain, ChainId } from "./contracts.js"

export type Block = {
	chain: Chain
	chainId: ChainId
	blocknum: number
	blockhash: string
	timestamp: number
}

export interface BlockProvider {
	chain: Chain
	chainId: ChainId
	getBlock: (key: string | number) => Promise<Block>
	onBlock: (cb: (block: Block) => void) => void
	removeOnBlock: () => void
}
