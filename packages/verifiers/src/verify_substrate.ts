import { decodeAddress } from "@polkadot/keyring"
import { stringToHex, hexToU8a, isU8a, isHex, u8aToHex } from "@polkadot/util"
import { checkAddress, encodeAddress, signatureVerify } from "@polkadot/util-crypto"

import type { Action, Session } from "@canvas-js/interfaces"

export const addressSwapper = (options: { address: string; currentPrefix: number }): string => {
	// TODO: do we need this?
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

export const verifySubstrate = (message: Action | Session): string => {
	const address = addressSwapper({
		address: message.payload.from,
		currentPrefix: 42,
	})
	const hexPublicKey = u8aToHex(decodeAddress(address))
	const signedMessage = stringToHex(JSON.stringify(message.payload))
	const signatureU8a =
		message.signature.slice(0, 2) === "0x" ? hexToU8a(message.signature) : hexToU8a(`0x${message.signature}`)
	if (signatureVerify(signedMessage, signatureU8a, hexPublicKey).isValid) {
		return address
	} else {
		return ""
	}
}
