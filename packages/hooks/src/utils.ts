import { Chain, ChainId, ModelValue } from "@canvas-js/interfaces"

export const getCanvasSessionKey = (chain: Chain, chainId: ChainId, address: string) =>
	`CANVAS_SESSION:${chain}:${chainId}:${address}`

// export type Dispatch = (call: string, args: Record<string, ActionArgument>) => Promise<{ hash: string }>

export function compareObjects(a: Record<string, ModelValue>, b: Record<string, ModelValue>) {
	for (const key in a) {
		if (a[key] !== b[key]) {
			return false
		}
	}

	for (const key in b) {
		if (b[key] !== a[key]) {
			return false
		}
	}
	return true
}

// export async function getRecentBlock(host: string, chain: Chain, chainId: ChainId): Promise<Block> {
// 	const res = await fetch(urlJoin(host, "latest_block", chain, chainId.toString()), { method: "GET" })
// 	const block = await res.json()
// 	// ethereum returns the chain id as a string but we are using a number (1, 5, etc)
// 	// this line replaces the chainId that comes from the API with our own chainId
// 	return { ...block, chainId }
// }
