import bs58 from "bs58"
import nacl from "tweetnacl"

import type { Action, Session } from "@canvas-js/interfaces"

export const verifySolana = (message: Action | Session): string => {
	const decodedAddress = bs58.decode(message.payload.from)

	if (decodedAddress.length !== 32) {
		// address is the wrong length
		return ""
	}
	if (
		!nacl.sign.detached.verify(
			Buffer.from(`${JSON.stringify(message.payload)}`),
			Buffer.from(message.signature, "base64"),
			decodedAddress
		)
	) {
		// signature does not match payload
		return ""
	}
	// payload is valid
	return message.payload.from
}
