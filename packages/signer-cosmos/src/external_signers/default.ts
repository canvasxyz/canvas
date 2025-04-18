import { toBech32 } from "@cosmjs/encoding"
import { hexToBytes } from "@noble/hashes/utils"
import { Wallet } from "ethers"

import { CosmosMessage } from "../types.js"
import { constructSiwxMessage } from "../utils.js"

export const createDefaultSigner = (bech32Prefix: string) => {
	const wallet = Wallet.createRandom()
	return {
		// this wallet is not associated with any chain
		getChainId: async () => "no_chain-id-100",
		getAddress: async () => toBech32(bech32Prefix, hexToBytes(wallet.address.substring(2))),
		sign: async (cosmosMessage: CosmosMessage) => {
			const msg = constructSiwxMessage(cosmosMessage)
			const hexSignature = (await wallet.signMessage(msg)).substring(2)
			return {
				signature: hexToBytes(hexSignature),
				signatureType: "ethereum" as const,
			}
		},
	}
}
