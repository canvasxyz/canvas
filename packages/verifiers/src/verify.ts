import type { Action, Session } from "@canvas-js/interfaces"
import { verifyEthereumActionSignature, verifyEthereumSessionSignature } from "./verify_ethereum.js"
import { verifySubstrateActionSignature, verifySubstrateSessionSignature } from "./verify_substrate.js"

/**
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 */
export function verifyActionSignature(action: Action): string {
	if (action.payload.chain == "eth") {
		return verifyEthereumActionSignature(action)
	} else {
		return verifySubstrateActionSignature(action)
	}
}

/**
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */
export function verifySessionSignature(session: Session): string {
	if (session.payload.chain == "eth") {
		return verifyEthereumSessionSignature(session)
	} else {
		return verifySubstrateSessionSignature(session)
	}
}
