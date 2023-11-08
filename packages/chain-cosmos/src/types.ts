import { Keplr } from "@keplr-wallet/types"

type EthereumSignedSessionData = {
	signatureType: "ethereum"
	signature: Uint8Array
}

type BytesSignedSessionData = {
	signatureType: "bytes"
	signature: {
		signature: Uint8Array
		pub_key: {
			type: string
			value: Uint8Array
		}
	}
}

type AminoSignedSessionData = {
	signatureType: "amino"
	signature: {
		signature: Uint8Array
		pub_key: {
			type: string
			value: Uint8Array
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

type CommonMethods = {
	getAddress: (chainId: string) => Promise<string>
	getChainId: () => Promise<string>
}

type EthereumSigner = { type: "ethereum" } & CommonMethods & {
		signEthereum: (chainId: string, signerAddress: string, message: string) => Promise<string>
	}
type AminoSigner = { type: "amino" } & CommonMethods & Pick<Keplr, "signAmino">
type BytesSigner = { type: "bytes" } & CommonMethods & {
		signBytes: (msg: Uint8Array) => Promise<{
			public_key: string
			signature: string
		}>
	}
type DirectSigner = { type: "direct" } & CommonMethods & Pick<Keplr, "signDirect">
type ArbitrarySigner = { type: "arbitrary" } & CommonMethods & Pick<Keplr, "signArbitrary">

export type ExternalCosmosSigner = EthereumSigner | AminoSigner | BytesSigner | DirectSigner | ArbitrarySigner
