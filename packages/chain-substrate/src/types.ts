import { KeypairType } from "@polkadot/util-crypto/types"

export type SubstrateSessionData = {
	signature: Uint8Array
	substrateKeyType: KeypairType
	data: SubstrateMessage
}

export type SubstrateMessage = {
	topic: string
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}
