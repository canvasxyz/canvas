import { TypedDataDomain, TypedDataField, utils } from "ethers"
import { verifyTypedData } from "@ethersproject/wallet"

import { makeActionToken, makeSessionToken } from "@canvas-js/interfaces"
import type { Action, ActionPayload, ActionToken, Session, SessionPayload, SessionToken } from "@canvas-js/interfaces"

/**
 * Ethereum compatible signer logic, used to generate and
 * verify EIP-712 signed data for wallets like Metamask.
 */

// TODO: ensure signed actions and sessions match what's expected
// by web3.js, which is less permissive than ethers when generating
// signTypedData messages.

const actionDataFields = {
	Message: [
		{ name: "sendAction", type: "string" },
		{ name: "params", type: "string[]" },
		{ name: "application", type: "string" },
		{ name: "timestamp", type: "uint256" },
	],
}

/**
 * `getActionSignatureData` gets EIP-712 signing data for an individual action
 */
export function getActionSignatureData(payload: ActionPayload): SignatureData<ActionToken> {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const actionToken = makeActionToken(payload)

	return [domain, actionDataFields, actionToken]
}

const sessionDataFields = {
	Message: [
		{ name: "loginTo", type: "string" },
		{ name: "registerSessionAddress", type: "string" },
		{ name: "registerSessionDuration", type: "uint256" },
		{ name: "timestamp", type: "uint256" },
	],
}

type SignatureData<TokenType> = [TypedDataDomain, Record<string, TypedDataField[]>, TokenType]

/**
 * `getSessionSignatureData` gets EIP-712 signing data to start a session
 */
export function getSessionSignatureData(payload: SessionPayload): SignatureData<SessionToken> {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const sessionToken = makeSessionToken(payload)

	return [domain, sessionDataFields, sessionToken]
}

export const verifyEthereumActionSignature = (action: Action): string => {
	const [domain, types, value] = getActionSignatureData(action.payload)
	return verifyTypedData(domain, types, value, action.signature).toLowerCase()
}

export const verifyEthereumSessionSignature = (session: Session): string => {
	const [domain, types, value] = getSessionSignatureData(session.payload)
	return verifyTypedData(domain, types, value, session.signature).toLowerCase()
}
