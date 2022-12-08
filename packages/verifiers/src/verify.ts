import type { Action, Session } from "@canvas-js/interfaces"
import { verifyEthereumActionSignature, verifyEthereumSessionSignature } from "./verify_ethereum.js"
import { verifySubstrate } from "./verify_substrate.js"

/**
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 */
export async function verifyActionSignature(action: Action): Promise<string> {
	if (action.payload.chain == "eth") {
		return verifyEthereumActionSignature(action)
	} else {
		return verifySubstrate(action)
	}
}

/**
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */
export async function verifySessionSignature(session: Session): Promise<string> {
	if (session.payload.chain == "eth") {
		return verifyEthereumSessionSignature(session)
	} else {
		return verifySubstrate(session)
	}
}
