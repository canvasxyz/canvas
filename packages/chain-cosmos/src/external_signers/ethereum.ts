import { fromBech32, toBech32 } from "@cosmjs/encoding"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { CosmosMessage } from "../types.js"
import { verifyMessage } from "ethers"

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
		const address = (await signer.getAddress(chainId)).substring(2)

		return toBech32(bech32Prefix, hexToBytes(address))
	},
	getChainId: signer.getChainId,
	sign: async (cosmosMessage: CosmosMessage, signerAddress: string, chainId: string) => {
		const encodedMessage = encodeReadableEthereumMessage(cosmosMessage)
		const ethAddress = `0x${bytesToHex(fromBech32(signerAddress).data)}`
		let signature = await signer.signEthereum(chainId, ethAddress, encodedMessage)
		// some signers prepend the `0x` in the signature result (metamask) and some don't (keplr)
		// we want to return the signature without this 0x prefix
		if (signature.slice(0, 2) === "0x") {
			signature = signature.slice(2)
		}
		return {
			signature: hexToBytes(signature),
			signatureType: "ethereum" as const,
		}
	},
})

export const verifyEthereum = (message: CosmosMessage, sessionData: EthereumSignedSessionData) => {
	const walletAddress = message.address
	const encodedReadableMessage = encodeReadableEthereumMessage(message)
	// validate ethereum signature
	const recoveredAddress = verifyMessage(encodedReadableMessage, `0x${bytesToHex(sessionData.signature)}`)
	const { prefix } = fromBech32(walletAddress)

	if (toBech32(prefix, hexToBytes(recoveredAddress.substring(2))) !== walletAddress) {
		throw Error("invalid signature")
	}
}

export type EthereumSignedSessionData = Awaited<ReturnType<ReturnType<typeof createEthereumSigner>["sign"]>>
