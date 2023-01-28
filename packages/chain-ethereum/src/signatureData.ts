import { TypedDataDomain, TypedDataField, utils } from "ethers"

import { ActionPayload, SessionPayload } from "@canvas-js/interfaces"

import { configure } from "safe-stable-stringify"
const serialize = configure({ circularValue: Error, bigint: false, deterministic: true, strict: true })

/**
 * Ethereum compatible signer logic, used to generate and
 * verify EIP-712 signed data for wallets like Metamask.
 */

// "You should not pass the EIP712Domain into ethers. It will compute it for you."
// - https://github.com/ethers-io/ethers.js/issues/687
export const actionDataFields = {
	Message: [
		{ name: "app", type: "string" },
		{ name: "appName", type: "string" },
		{ name: "block", type: "string" },
		{ name: "call", type: "string" },
		{ name: "callArgs", type: "string" },
		{ name: "chain", type: "string" },
		{ name: "chainId", type: "string" },
		{ name: "from", type: "string" },
		{ name: "timestamp", type: "uint64" },
	],
}

type ActionPayloadSignable = Omit<ActionPayload, "callArgs"> & { callArgs: string }

/**
 * gets EIP-712 signing data for an individual action
 */
export function getActionSignatureData(payload: ActionPayload): SignatureData<ActionPayloadSignable> {
	const domain = {
		name: payload.appName,
	}

	// Rewrite fields with custom serializations. EIP-712 does not
	// accept null values as a type, so we replace the null blockhash
	// with an empty string

	// Previously chainId may have been an integer. Since TS is not
	// enforced at runtime, call .toString() to be sure
	const actionValue = {
		...payload,
		callArgs: serialize(payload.callArgs),
		chainId: payload.chainId.toString(),
		block: payload.block || "",
	}

	return [domain, actionDataFields, actionValue]
}

// "You should not pass the EIP712Domain into ethers. It will compute it for you."
// - https://github.com/ethers-io/ethers.js/issues/687
export const sessionDataFields = {
	Message: [
		{ name: "app", type: "string" },
		{ name: "appName", type: "string" },
		{ name: "block", type: "string" },
		{ name: "chain", type: "string" },
		{ name: "chainId", type: "string" },
		{ name: "from", type: "string" },
		{ name: "sessionAddress", type: "string" },
		{ name: "sessionDuration", type: "uint64" },
		{ name: "sessionIssued", type: "uint64" },
	],
}

type SignatureData<PayloadType> = [TypedDataDomain, Record<string, TypedDataField[]>, PayloadType]

/**
 * gets EIP-712 signing data to start a session
 */
export function getSessionSignatureData(payload: SessionPayload): SignatureData<SessionPayload> {
	const domain = {
		name: payload.appName,
	}

	// Rewrite fields with custom serializations. EIP-712 does not
	// accept null values as a type, so we replace the null blockhash
	// with an empty string.
	//
	// Previously chainId may have been an integer. Since TS is not
	// enforced at runtime, call .toString() to be sure
	const sessionValue = {
		...payload,
		chainId: payload.chainId.toString(),
		block: payload.block || "",
	}

	return [domain, sessionDataFields, sessionValue]
}
