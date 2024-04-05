import { fromBech32, toBech32 } from "@cosmjs/encoding"
import { CosmosMessage } from "../types.js"
import { verifyMessage, getBytes, toQuantity } from "ethers"

export function encodeReadableEthereumMessage(message: CosmosMessage): string {
	return `
	Authorize access?
	address: ${message.address}
	chainId: ${message.chainId}
	expirationTime: ${message.expirationTime}
	issuedAt: ${message.issuedAt}
	uri: ${message.publicKey}
	`
}

export type EthereumSigner = {
	type: "ethereum"
	getAddress: (chainId: string) => Promise<string>
	getChainId: () => Promise<string>
	signEthereum: (chainId: string, signerAddress: string, message: string) => Promise<string>
}

export const createEthereumSigner = (signer: EthereumSigner, bech32Prefix: string) => ({
	getAddress: async (chainId: string) => {
		const address = await signer.getAddress(chainId)
		// this assumes that `address` is an ethereum hex address prefixed by 0x
		return toBech32(bech32Prefix, getBytes(address))
	},
	getChainId: signer.getChainId,
	sign: async (cosmosMessage: CosmosMessage, signerAddress: string, chainId: string) => {
		const encodedMessage = encodeReadableEthereumMessage(cosmosMessage)
		const ethAddress = toQuantity(fromBech32(signerAddress).data)
		const signature = await signer.signEthereum(chainId, ethAddress, encodedMessage)
		// signature is a hex string prefixed by 0x
		return {
			signature: getBytes(signature),
			signatureType: "ethereum" as const,
		}
	},
})

export const verifyEthereum = (message: CosmosMessage, sessionData: EthereumSignedSessionData) => {
	const walletAddress = message.address
	const encodedReadableMessage = encodeReadableEthereumMessage(message)
	// validate ethereum signature
	const recoveredAddress = verifyMessage(encodedReadableMessage, toQuantity(sessionData.signature))
	const { prefix } = fromBech32(walletAddress)

	if (toBech32(prefix, getBytes(recoveredAddress)) !== walletAddress) {
		throw Error("invalid signature")
	}
}

export type EthereumSignedSessionData = Awaited<ReturnType<ReturnType<typeof createEthereumSigner>["sign"]>>

export function validateEthereumSignedSessionData(data: any): data is EthereumSignedSessionData {
	return data.signatureType == "ethereum" && data.signature instanceof Uint8Array
}
