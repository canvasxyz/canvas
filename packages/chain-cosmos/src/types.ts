import type { EthereumSignedSessionData, EthereumSigner } from "./external_signers/ethereum.js"
import type { BytesSignedSessionData, BytesSigner } from "./external_signers/bytes.js"
import type { AminoSignedSessionData, AminoSigner } from "./external_signers/amino.js"

export type CosmosMessage = {
	topic: string
	address: string
	chainId: string
	publicKey: string
	issuedAt: string
	expirationTime: string | null
}

export type CosmosSessionData = EthereumSignedSessionData | BytesSignedSessionData | AminoSignedSessionData

export type ExternalCosmosSigner = EthereumSigner | AminoSigner | BytesSigner
