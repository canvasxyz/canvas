import { verifyTypedData } from "@ethersproject/wallet"

import type { Verifier } from "@canvas-js/interfaces"

import { getActionSignatureData, getSessionSignatureData } from "./types.js"

export const ethereumVerifier: Verifier = {
	match: (chain, chainId) => chain === "ethereum",
	async verifyAction(action) {
		const expectedAddress = action.session ?? action.payload.from
		const [domain, types, value] = getActionSignatureData(action.payload)
		const recoveredAddress = verifyTypedData(domain, types, value, action.signature)
		if (recoveredAddress !== expectedAddress) {
			throw new Error(`Invalid action signature: expected ${expectedAddress}, recovered ${recoveredAddress}`)
		}
	},
	async verifySession(session) {
		const [domain, types, value] = getSessionSignatureData(session.payload)
		const recoveredAddress = verifyTypedData(domain, types, value, session.signature)
		if (recoveredAddress !== session.payload.from) {
			throw new Error(`Invalid session signature: expected ${session.payload.from}, recovered ${recoveredAddress}`)
		}
	},
}
