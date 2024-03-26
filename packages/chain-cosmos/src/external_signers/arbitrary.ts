import { Secp256k1, Secp256k1Signature, Sha256 } from "@cosmjs/crypto"
import { CosmosMessage } from "../types.js"
import { serializeSignDoc } from "@cosmjs/amino"
import { fromBase64 } from "@cosmjs/encoding"
import { getSessionSignatureData } from "../signatureData.js"

const createSiwxMessage = (message: CosmosMessage): string => {
	return "siwx message"
}

export type ArbitrarySigner = {
	type: "arbitrary"
	getAddress: (chainId: string) => Promise<string>
	getChainId: () => Promise<string>
	signArbitrary: (msg: string) => Promise<{
		pub_key: {
			type: string
			value: string
		}
		signature: string
	}>
}

export const createArbitrarySigner = (signer: ArbitrarySigner) => ({
	getAddress: signer.getAddress,
	getChainId: signer.getChainId,
	sign: async (cosmosMessage: CosmosMessage) => {
		// make SIWx message
		const siwxMessage = createSiwxMessage(cosmosMessage)
		// call sign
		const res = await signer.signArbitrary(siwxMessage)
		console.log(res)
		return {
			signature: res,
			signatureType: "arbitrary" as const,
		}
	},
})

export const verifyArbitrary = async (message: CosmosMessage, sessionData: ArbitrarySignedSessionData) => {
	const siwxMessage = createSiwxMessage(message)
	// how is the string encoded?
	const signDoc = getSessionSignatureData(new TextEncoder().encode(siwxMessage), message.address)

	const { signature, pub_key } = sessionData.signature
	const secpSignature = Secp256k1Signature.fromFixedLength(fromBase64(signature))
	const messageHash = new Sha256(serializeSignDoc(signDoc)).digest()
	const isValid = await Secp256k1.verifySignature(secpSignature, messageHash, fromBase64(pub_key.value))
	if (!isValid) {
		throw Error("not valid")
	}
}

export type ArbitrarySignedSessionData = Awaited<ReturnType<ReturnType<typeof createArbitrarySigner>["sign"]>>

export function validateArbitrarySignedSessionData(data: any): data is ArbitrarySignedSessionData {
	return (
		data.signatureType == "arbitrary" &&
		data.signature instanceof Object &&
		typeof data.signature.pub_key === "object" &&
		typeof data.signature.signature === "string"
	)
}
