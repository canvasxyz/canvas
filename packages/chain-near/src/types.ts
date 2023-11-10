import { PublicKey } from "near-api-js/lib/utils"

export type NEARMessage = {
	publicKey: string
	issuedAt: string
	expirationTime: string | null
}

export type NEARSessionData = {
	signature: Uint8Array
	publicKey: Uint8Array
}
