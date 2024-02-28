import type { EthereumSignedSessionData, EthereumSigner } from "./external_signers/ethereum.js"
import type { BytesSignedSessionData, BytesSigner } from "./external_signers/bytes.js"
import type { AminoSignedSessionData, AminoSigner } from "./external_signers/amino.js"
import type { Adr036SignedSessionData, Adr036Signer } from "./external_signers/adr036.js"

export type CosmosMessage = {
	topic: string
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}

export type CosmosSessionData =
	| EthereumSignedSessionData
	| BytesSignedSessionData
	| AminoSignedSessionData
	| Adr036SignedSessionData

export type ExternalCosmosSigner = EthereumSigner | AminoSigner | BytesSigner | Adr036Signer
