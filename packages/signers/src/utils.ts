import { isU8a, isHex } from "@polkadot/util"
import { checkAddress, decodeAddress, encodeAddress } from "@polkadot/util-crypto"

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
