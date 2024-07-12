import { AminoSignResponse, StdSignDoc } from "@keplr-wallet/types"
import { base64 } from "multiformats/bases/base64"
import { rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "@cosmjs/amino"
import { fromBech32, toBech32 } from "@cosmjs/encoding"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"

import { CosmosMessage } from "../types.js"
import { getSessionSignatureData } from "../signatureData.js"
import { constructSiwxMessage } from "../utils.js"
import { Awaitable } from "@canvas-js/interfaces"

export type AminoSigner = {
	type: "amino"
	getAddress: (chainId: string) => Awaitable<string>
	getChainId: () => Awaitable<string>
	signAmino(chainId: string, signer: string, signDoc: StdSignDoc): Awaitable<AminoSignResponse>
}

export const createAminoSigner = (signer: AminoSigner) => ({
	getAddress: signer.getAddress,
	getChainId: signer.getChainId,
	sign: async (cosmosMessage: CosmosMessage, address: string, chainId: string) => {
		const msg = new TextEncoder().encode(constructSiwxMessage(cosmosMessage))
		const signDoc = getSessionSignatureData(msg, address)
		const signRes = await signer.signAmino(chainId, address, signDoc)
		const stdSig = signRes.signature

		return {
			signature: base64.baseDecode(stdSig.signature),
			signatureType: "amino" as const,
		}
	},
})

export const verifyAmino = async (message: CosmosMessage, { signature }: AminoSignedSessionData) => {
	const walletAddress = message.address
	const { prefix } = fromBech32(walletAddress)

	// the payload can either be signed directly, or encapsulated in a SignDoc
	const encodedMessage = new TextEncoder().encode(constructSiwxMessage(message))
	const signDocPayload = getSessionSignatureData(encodedMessage, walletAddress)
	const signDocDigest = sha256(serializeSignDoc(signDocPayload))

	// try with both values of the recovery bit
	for (const recoveryBit of [0, 1]) {
		const signatureWithRecoveryBit = secp256k1.Signature.fromCompact(signature).addRecoveryBit(recoveryBit)
		// get the public key from the signature and digest
		const pub_key = signatureWithRecoveryBit.recoverPublicKey(signDocDigest).toRawBytes()
		// get the address from the public key
		const address = toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pub_key))
		if (address == walletAddress) return
	}

	throw Error("invalid signature")
}

export type AminoSignedSessionData = Awaited<ReturnType<ReturnType<typeof createAminoSigner>["sign"]>>

export function validateAminoSignedSessionData(data: any): data is AminoSignedSessionData {
	return data.signatureType == "amino" && data.signature instanceof Uint8Array
}
