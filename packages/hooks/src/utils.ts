import { Chain, ChainId, ModelValue } from "@canvas-js/interfaces"

export const getCanvasSessionKey = (chain: Chain, chainId: ChainId, address: string) =>
	`CANVAS_SESSION:${chain}:${chainId}:${address}`

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
