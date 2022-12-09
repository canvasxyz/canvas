import bs58 from "bs58"
import nacl from "tweetnacl"

import type { Action, Session } from "@canvas-js/interfaces"

const verifySolana = (message: Action | Session, expectedAddress: string): string => {
	const decodedAddress = bs58.decode(expectedAddress)

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
	return expectedAddress.toLowerCase()
}

export const verifySolanaActionSignature = (action: Action): string => {
	if (!action.session) {
		return ""
	}
	return verifySolana(action, action.session)
}
export const verifySolanaSessionSignature = (session: Session): string => {
	return verifySolana(session, session.payload.from)
}
