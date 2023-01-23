import { TypedDataDomain, TypedDataField, utils } from "ethers"
import { verifyTypedData } from "@ethersproject/wallet"

import { Action, ActionPayload, Session, SessionPayload, serializeActionArgument } from "@canvas-js/interfaces"

/**
 * Ethereum compatible signer logic, used to generate and
 * verify EIP-712 signed data for wallets like Metamask.
 */

// TODO: ensure signed actions and sessions match what's expected
// by web3.js, which is less permissive than ethers when generating
// signTypedData messages.

const actionDataFields = {
	Message: [
		{ name: "from", type: "string" },
		{ name: "spec", type: "string" },
		{ name: "timestamp", type: "uint256" },
		{ name: "chain", type: "string" },
		{ name: "chainId", type: "string" },
		{ name: "blockhash", type: "string" },
		{ name: "call", type: "string" },
		{ name: "args", type: "string[]" },
	],
}

const namePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/

/**
 * `getActionSignatureData` gets EIP-712 signing data for an individual action
 */
export function getActionSignatureData(payload: ActionPayload): SignatureData<
	Omit<ActionPayload, "args"> & {
		args: string[]
	}
> {
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

	// Replace the params field with a list of values instead of a record
	const actionValue = {
		...payload,
		args: params,
		chainId: payload.chainId.toString(),
		// EIP-712 does not accept null values as a type, so we replace the null blockhash
		// with an empty string
		blockhash: payload.blockhash || "",
	}

	return [domain, actionDataFields, actionValue]
}

const sessionDataFields = {
	Message: [
		{ name: "from", type: "string" },
		{ name: "spec", type: "string" },
		{ name: "sessionAddress", type: "string" },
		{ name: "sessionDuration", type: "uint256" },
		{ name: "sessionIssued", type: "uint256" },
		{ name: "blockhash", type: "string" },
		{ name: "chain", type: "string" },
		{ name: "chainId", type: "string" },
	],
}

type SignatureData<PayloadType> = [TypedDataDomain, Record<string, TypedDataField[]>, PayloadType]

/**
 * `getSessionSignatureData` gets EIP-712 signing data to start a session
 */
export function getSessionSignatureData(payload: SessionPayload): SignatureData<SessionPayload> {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}
	const sessionValue = {
		...payload,
		// EIP-712 does not accept null values as a type, so we replace the null blockhash
		// with an empty string
		chainId: payload.chainId.toString(),
		blockhash: payload.blockhash || "",
	}

	return [domain, sessionDataFields, sessionValue]
}

export const verifyEthereumActionSignature = (action: Action): string => {
	const [domain, types, value] = getActionSignatureData(action.payload)
	return verifyTypedData(domain, types, value, action.signature)
}

export const verifyEthereumSessionSignature = (session: Session): string => {
	const [domain, types, value] = getSessionSignatureData(session.payload)
	return verifyTypedData(domain, types, value, session.signature)
}
