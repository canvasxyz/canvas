import { TypedDataDomain, TypedDataField, utils } from "ethers"
import { verifyTypedData } from "@ethersproject/wallet"

import type { Action, ActionArgument, ActionPayload } from "./actions.js"
import type { Session, SessionPayload } from "./sessions.js"

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

// JSON.stringify has lossy behavior on the number values +/-Infinity, NaN, and -0.
// We never actually parse these serialized arguments anywhere - the only purpose here
// is to map them injectively to strings for signing.
function serializeActionArgument(arg: ActionArgument): string {
	if (typeof arg === "number") {
		if (isNaN(arg)) {
			return "NaN"
		} else if (Object.is(arg, -0)) {
			return "-0"
		} else if (arg === Infinity) {
			return "Infinity"
		} else if (arg === -Infinity) {
			return "-Infinity"
		} else {
			return arg.toString()
		}
	} else {
		return JSON.stringify(arg)
	}
}

type SignatureData = [TypedDataDomain, Record<string, TypedDataField[]>, Record<string, string | string[]>]

const namePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/

/**
 * `getActionSignatureData` gets EIP-712 signing data for an individual action
 */
export function getActionSignatureData(payload: ActionPayload): SignatureData {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const keys = Object.keys(payload.args).sort()
	const params = keys.map((key) => {
		if (namePattern.test(key)) {
			return `${key}: ${serializeActionArgument(payload.args[key])}`
		} else {
			throw new Error("invalid argument name")
		}
	})

	const actionValue = {
		sendAction: payload.call,
		params: params,
		application: payload.spec,
		timestamp: payload.timestamp.toString(),
	}

	return [domain, actionDataFields, actionValue]
}

/**
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 */
export function verifyActionSignature(action: Action): string {
	const [domain, types, value] = getActionSignatureData(action.payload)
	return verifyTypedData(domain, types, value, action.signature).toLowerCase()
}

const sessionDataFields = {
	Message: [
		{ name: "loginTo", type: "string" },
		{ name: "registerSessionAddress", type: "string" },
		{ name: "registerSessionDuration", type: "uint256" },
		{ name: "timestamp", type: "uint256" },
	],
}

/**
 * `getSessionSignatureData` gets EIP-712 signing data to start a session
 */
export function getSessionSignatureData(payload: SessionPayload): SignatureData {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const sessionValue = {
		loginTo: payload.spec,
		registerSessionAddress: payload.address.toLowerCase(),
		registerSessionDuration: payload.duration.toString(),
		timestamp: payload.timestamp.toString(),
	}

	return [domain, sessionDataFields, sessionValue]
}

/**
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */
export function verifySessionSignature(session: Session): string {
	const [domain, types, value] = getSessionSignatureData(session.payload)
	return verifyTypedData(domain, types, value, session.signature).toLowerCase()
}
