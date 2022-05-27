import { utils } from "ethers"
// import { recoverTypedSignature, SignTypedDataVersion } from "@metamask/eth-sig-util"
import { verifyTypedData } from "@ethersproject/wallet"
import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer"

import type { Action, ActionArgument, ActionPayload } from "./actions.js"
import type { Session, SessionPayload } from "./sessions.js"

/**
 * Ethereum compatible signer logic, used to generate and
 * verify EIP-712 signed data for wallets like Metamask.
 *
 * `getActionSignatureData` gets EIP-712 signing data for an individual action
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 * `getSessionSignatureData` gets EIP-712 signing data to start a session
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */

export function getActionSignatureData(
	payload: ActionPayload
): [TypedDataDomain, Record<string, TypedDataField[]>, Record<string, any>] {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const actionTypes = {
		Message: [
			{ name: "sendAction", type: "string" },
			{ name: "params", type: "string[]" },
			{ name: "application", type: "string" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	const actionValue = {
		sendAction: payload.call,
		params: payload.args.map((a: ActionArgument) => JSON.stringify(a)),
		application: payload.spec,
		timestamp: payload.timestamp.toString(),
	}

	return [domain, actionTypes, actionValue]
}

export function verifyActionSignature(action: Action): string {
	const [domain, types, value] = getActionSignatureData(action.payload)
	return verifyTypedData(domain, types, value, action.signature)
}

export function getSessionSignatureData(
	payload: SessionPayload
): [TypedDataDomain, Record<string, TypedDataField[]>, Record<string, any>] {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const sessionTypes = {
		Message: [
			{ name: "loginTo", type: "string" },
			{ name: "registerSessionKey", type: "string" },
			{ name: "registerSessionDuration", type: "uint256" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	const sessionValue = {
		loginTo: payload.spec,
		registerSessionKey: payload.session_public_key,
		registerSessionDuration: payload.session_duration.toString(),
		timestamp: payload.timestamp.toString(),
	}

	return [domain, sessionTypes, sessionValue]
}

export function verifySessionSignature(session: Session): string {
	const [domain, types, value] = getSessionSignatureData(session.payload)
	return verifyTypedData(domain, types, value, session.signature)
}
