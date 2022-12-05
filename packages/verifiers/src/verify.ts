import { TypedDataDomain, TypedDataField, utils } from "ethers"
import { verifyTypedData } from "@ethersproject/wallet"
import { decodeAddress } from "@polkadot/keyring"
import { stringToHex, hexToU8a, u8aToHex } from "@polkadot/util"

import type { Action, ActionArgument, ActionPayload, Session, SessionPayload } from "@canvas-js/interfaces"

import { isU8a, isHex } from "@polkadot/util"
import { checkAddress, encodeAddress, signatureVerify } from "@polkadot/util-crypto"

export const addressSwapper = (options: { address: string; currentPrefix: number }): string => {
	if (!options.address) throw new Error("No address provided to swap")

	if (!options.currentPrefix) return options.address

	if (isU8a(options.address) || isHex(options.address)) {
		throw new Error("address not in SS58 format")
	}

	// check if it is valid as an address
	let decodedAddress: Uint8Array

	try {
		decodedAddress = decodeAddress(options.address)
	} catch (e) {
		throw new Error("failed to decode address")
	}

	// check if it is valid with the current prefix & reencode if needed
	const [valid, errorMsg] = checkAddress(options.address, options.currentPrefix)

	if (!valid) {
		try {
			return encodeAddress(decodedAddress, options.currentPrefix)
		} catch (e) {
			throw new Error("failed to reencode address")
		}
	} else {
		return options.address
	}
}

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

/**
 * `getActionSignatureData` gets EIP-712 signing data for an individual action
 */
export function getActionSignatureData(payload: ActionPayload): SignatureData {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(payload.from), 32)),
	}

	const actionValue = {
		sendAction: payload.call,
		params: payload.args.map(serializeActionArgument),
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
	const isSubstrate = payload.chain == "substrate"

	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(isSubstrate ? decodeAddress(payload.from) : utils.arrayify(payload.from), 32)),
	}

	const sessionValue = {
		loginTo: payload.spec,
		registerSessionAddress: payload.address.toLowerCase(),
		registerSessionDuration: payload.duration.toString(),
		timestamp: payload.timestamp.toString(),
	}

	return [domain, sessionDataFields, sessionValue]
}

const verifySubstrate = (session: Session): string => {
	//
	// substrate address handling
	//

	const address = addressSwapper({
		address: session.payload.from,
		currentPrefix: 42,
	})

	console.log("address:", address)

	const hexPublicKey = u8aToHex(decodeAddress(address))
	const signedMessage = stringToHex(JSON.stringify(session.payload))
	const signatureU8a =
		session.signature.slice(0, 2) === "0x" ? hexToU8a(session.signature) : hexToU8a(`0x${session.signature}`)
	if (signatureVerify(signedMessage, signatureU8a, hexPublicKey).isValid) {
		return address
	} else {
		return ""
	}

	// only support whatever the default keyringoption is? idk
	// const signerKeyring = new Keyring({ type: "ed25519" }).addFromAddress(address)
	// const message = stringToHex(JSON.stringify(session.payload))
	// const signatureString = session.signature
	// const signatureU8a =
	// 	signatureString.slice(0, 2) === "0x" ? hexToU8a(signatureString) : hexToU8a(`0x${signatureString}`)

	// console.log(message)
	// console.log(signatureString)
	// console.log(signatureU8a.toString())
	// console.log(address)
	// if (signerKeyring.verify(message, signatureU8a, address)) {
	// 	return address
	// } else {
	// 	return ""
	// }
}

/**
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */
export function verifySessionSignature(session: Session): string {
	if (session.payload.chain == "eth") {
		const [domain, types, value] = getSessionSignatureData(session.payload)
		return verifyTypedData(domain, types, value, session.signature).toLowerCase()
	} else {
		return verifySubstrate(session)
	}
}
