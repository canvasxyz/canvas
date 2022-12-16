import type { Action, Session } from "@canvas-js/interfaces"
import { verifyEthereumActionSignature, verifyEthereumSessionSignature } from "./verify_ethereum.js"
import { verifyCosmosSessionSignature } from "./verify_cosmos.js"
import { verifySubstrate } from "./verify_substrate.js"
import { verifySolanaSessionSignature } from "./verify_solana.js"
import { verifyEvmosSessionSignature } from "./verify_evmos.js"
import { verifyTerraSessionSignature } from "./verify_terra.js"

/**
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 */
export async function verifyActionSignature(action: Action): Promise<string> {
	// for now, actions are always signed using an ethereum address
	return verifyEthereumActionSignature(action)
}

/**
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */
export async function verifySessionSignature(session: Session): Promise<string> {
	console.log(session)
	if (session.payload.chain == "eth") {
		return verifyEthereumSessionSignature(session)
	} else if (session.payload.chain == "substrate") {
		return verifySubstrate(session)
	} else if (session.payload.chain == "cosmos") {
		if (session.payload.chainId == "evmos_9001-2") {
			return verifyEvmosSessionSignature(session)
		} else if (session.payload.chainId == "phoenix-1") {
			return verifyTerraSessionSignature(session)
		} else {
			return verifyCosmosSessionSignature(session)
		}
	} else if (session.payload.chain == "solana") {
		return verifySolanaSessionSignature(session)
	} else {
		throw Error(`chain ${session.payload.chain} is not supported`)
	}
}
