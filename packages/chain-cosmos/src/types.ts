import { Keplr } from "@keplr-wallet/types"

type EthereumSignedSessionData = {
	signatureType: "ethereum"
	signature: Uint8Array
}

type BytesSignedSessionData = {
	signatureType: "bytes"
	signature: {
		signature: string
		pub_key: {
			type: string
			value: string
		}
	}
}

type AminoSignedSessionData = {
	signatureType: "amino"
	signature: {
		signature: string
		pub_key: {
			type: string
			value: string
		}
	}
}

export type CosmosSessionData = EthereumSignedSessionData | BytesSignedSessionData | AminoSignedSessionData

export type CosmosMessage = {
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}

type GetAddressMethod = {
	getAddress: (chainId: string) => Promise<string>
}

type EthereumSigner = { type: "ethereum" } & GetAddressMethod & {
		signEthereum: (chainId: string, signerAddress: string, message: string) => Promise<string>
	}
type AminoSigner = { type: "amino" } & GetAddressMethod & Pick<Keplr, "signAmino">
type BytesSigner = { type: "bytes" } & GetAddressMethod & {
		signBytes: (msg: Uint8Array) => Promise<{
			public_key: string
			signature: string
		}>
	}
type DirectSigner = { type: "direct" } & GetAddressMethod & Pick<Keplr, "signDirect">
type ArbitrarySigner = { type: "arbitrary" } & GetAddressMethod & Pick<Keplr, "signArbitrary">

export type ExternalCosmosSigner = EthereumSigner | AminoSigner | BytesSigner | DirectSigner | ArbitrarySigner
