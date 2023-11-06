import type { AminoSignResponse, OfflineAminoSigner } from "@keplr-wallet/types"
import type { AccountData } from "@cosmjs/amino"
import type { FixedExtension } from "@terra-money/wallet-controller/modules/legacy-extension"

type EtheremSignedSessionData = {
	signatureType: "ethereum"
	signature: string
}

type CosmosSignedSessionData = {
	signatureType: "cosmos"
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

export type CosmosSessionData = EtheremSignedSessionData | CosmosSignedSessionData | AminoSignedSessionData

export type CosmosMessage = {
	address: string
	chainId: string
	uri: string
	issuedAt: string
	expirationTime: string | null
}

interface OfflineSigner {
	getAccounts: () => AccountData[]
}

export interface KeplrAminoSigner {
	getAddress: (chainId: string) => Promise<string>
	signAmino: (chainId: string, signerAddress: string, signDoc: any) => Promise<AminoSignResponse>
}

export interface KeplrEthereumSigner {
	signEthereum: (chainId: string, address: string, dataToSign: string, ethSignType: "message") => Promise<Uint8Array>
	getOfflineSigner: (chainId: string) => OfflineSigner
}

export interface EvmMetaMaskSigner {
	eth: {
		personal: { sign: (dataToSign: string, address: string, password: string) => Promise<string> }
		getAccounts: () => Promise<string[]>
	}
}

export type ExternalCosmosSigner = EvmMetaMaskSigner | KeplrEthereumSigner | KeplrAminoSigner | FixedExtension

export function isEvmMetaMaskSigner(signer: unknown): signer is EvmMetaMaskSigner {
	return (
		!!signer &&
		typeof signer === "object" &&
		"eth" in signer &&
		!!signer.eth &&
		typeof signer.eth === "object" &&
		"personal" in signer.eth &&
		typeof signer.eth.personal === "object" &&
		"getAccounts" in signer.eth &&
		typeof signer.eth.getAccounts === "function"
	)
}

export function isKeplrEthereumSigner(signer: unknown): signer is KeplrEthereumSigner {
	return (
		!!signer &&
		typeof signer === "object" &&
		"signEthereum" in signer &&
		typeof signer.signEthereum === "function" &&
		"getOfflineSigner" in signer &&
		typeof signer.getOfflineSigner === "function"
	)
}

export function isKeplrAminoSigner(signer: unknown): signer is KeplrAminoSigner {
	return (
		!!signer &&
		typeof signer === "object" &&
		"getAddress" in signer &&
		typeof signer.getAddress === "function" &&
		"signAmino" in signer &&
		typeof signer.signAmino === "function"
	)
}

export function isTerraFixedExtension(signer: unknown): signer is FixedExtension {
	if (!(!!signer && typeof signer === "object")) {
		return false
	}

	const functions = ["post", "sign", "signBytes", "info", "connect", "inTransactionProgress", "disconnect"]
	for (const funcName of functions) {
		// const fn = signer[funcName]
		if (!(funcName in signer && typeof (signer as any)[funcName] === "function")) {
			return false
		}
	}
	return true
}
