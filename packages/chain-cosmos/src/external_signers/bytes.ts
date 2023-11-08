import * as cbor from "@ipld/dag-cbor"
import { base64 } from "multiformats/bases/base64"
import { pubkeyType } from "@cosmjs/amino"
import { CosmosMessage } from "../types.js"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"

export type BytesSigner = {
	type: "bytes"
	getAddress: (chainId: string) => Promise<string>
	getChainId: () => Promise<string>
	signBytes: (msg: Uint8Array) => Promise<{
		public_key: string
		signature: string
	}>
}

export const createBytesSigner = (signer: BytesSigner) => ({
	getAddress: signer.getAddress,
	getChainId: signer.getChainId,
	sign: async (cosmosMessage: CosmosMessage) => {
		const msg = cbor.encode(cosmosMessage)
		const { public_key, signature } = await signer.signBytes(msg)
		return {
			signature: {
				signature: base64.baseDecode(signature),
				pub_key: {
					type: pubkeyType.secp256k1,
					value: base64.baseDecode(public_key),
				},
			},
			signatureType: "bytes" as const,
		}
	},
})

export const verifyBytes = (message: CosmosMessage, sessionData: BytesSignedSessionData) => {
	const { pub_key, signature } = sessionData.signature
	// cosmos supports other public key types, but for the sake of simplicity
	// just support secp256k1
	if (pub_key.type !== pubkeyType.secp256k1) throw Error(`invalid public key type ${pub_key.type}`)

	// signBytes signs the sha256 hash of the message
	const encodedMessage = cbor.encode(message)
	const hash = sha256(encodedMessage)
	if (!secp256k1.verify(signature, hash, pub_key.value)) throw Error("invalid signature")
}

export type BytesSignedSessionData = Awaited<ReturnType<ReturnType<typeof createBytesSigner>["sign"]>>
