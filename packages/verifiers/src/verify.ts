import type { Action, Session } from "@canvas-js/interfaces"
import { verifyEthereumActionSignature, verifyEthereumSessionSignature } from "./ethereum/verify_ethereum.js"

/**
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 */
export async function verifyActionSignature(action: Action): Promise<string> {
	if (action.payload.chain == "eth") {
		return verifyEthereumActionSignature(action)
	} else {
		throw Error(`chain ${action.payload.chain} is not supported`)
	}
}

/**
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */
export async function verifySessionSignature(session: Session): Promise<string> {
	if (session.payload.chain == "eth") {
		return verifyEthereumSessionSignature(session)
	} else {
		throw Error(`chain ${session.payload.chain} is not supported`)
	}
}
