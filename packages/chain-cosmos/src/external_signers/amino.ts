import * as cbor from "@ipld/dag-cbor"
import { AminoSignResponse, StdSignDoc } from "@keplr-wallet/types"
import { base64 } from "multiformats/bases/base64"
import { pubkeyType, rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "@cosmjs/amino"

import { CosmosMessage } from "../types.js"
import { getSessionSignatureData } from "../signatureData.js"
import { fromBech32, toBech32 } from "@cosmjs/encoding"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"

export type AminoSigner = {
	type: "amino"
	getAddress: (chainId: string) => Promise<string>
	getChainId: () => Promise<string>
	signAmino(chainId: string, signer: string, signDoc: StdSignDoc): Promise<AminoSignResponse>
}

export const createAminoSigner = (signer: AminoSigner) => ({
	getAddress: signer.getAddress,
	getChainId: signer.getChainId,
	sign: async (cosmosMessage: CosmosMessage, address: string, chainId: string) => {
		const msg = cbor.encode(cosmosMessage)
		const signDoc = await getSessionSignatureData(msg, address)
		const signRes = await signer.signAmino(chainId, address, signDoc)
		const stdSig = signRes.signature

		return {
			signature: {
				signature: base64.baseDecode(stdSig.signature),
				pub_key: {
					type: pubkeyType.secp256k1,
					value: base64.baseDecode(stdSig.pub_key.value),
				},
			},
			signatureType: "amino" as const,
		}
	},
})

export const verifyAmino = async (message: CosmosMessage, sessionData: AminoSignedSessionData) => {
	const {
		pub_key: { value: pub_key },
		signature,
	} = sessionData.signature

	const walletAddress = message.address
	const { prefix } = fromBech32(walletAddress)
	if (walletAddress !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pub_key))) {
		throw new Error("Session signed with a pubkey that doesn't match the session address")
	}

	// the payload can either be signed directly, or encapsulated in a SignDoc
	const encodedMessage = cbor.encode(message)
	const signDocPayload = await getSessionSignatureData(encodedMessage, walletAddress)
	const signDocDigest = sha256(serializeSignDoc(signDocPayload))
	const digest = sha256(encodedMessage)

	// compare the signature against the directly signed and signdoc digests
	let isValid = false
	isValid ||= secp256k1.verify(signature, signDocDigest, pub_key)
	isValid ||= secp256k1.verify(signature, digest, pub_key)
	if (!isValid) throw Error("invalid signature")
}

export type AminoSignedSessionData = Awaited<ReturnType<ReturnType<typeof createAminoSigner>["sign"]>>
