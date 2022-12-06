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

export const verifySubstrateActionSignature = (action: Action): string => {
	const address = addressSwapper({
		address: action.payload.from,
		currentPrefix: 42,
	})
	return address
}

export const verifySubstrateSessionSignature = (session: Session): string => {
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
