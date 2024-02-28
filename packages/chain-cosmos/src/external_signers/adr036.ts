import * as cbor from "@ipld/dag-cbor"
import type { CosmosMessage } from "../types.js"
import cosm, { AminoMsg, StdFee, StdSignDoc } from "@cosmjs/amino"
import cosmAmino from "@cosmjs/amino"
import cosmEnc from "@cosmjs/encoding"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"

const getADR036SignableSession = (token: Uint8Array, address: string, chainId = ""): StdSignDoc => {
	const accountNumber = 0
	const sequence = 0
	const fee: StdFee = {
		gas: "0",
		amount: [],
	}
	const memo = ""

	const jsonTx: AminoMsg = {
		type: "sign/MsgSignData",
		value: {
			signer: address,
			data: cosmEnc.toBase64(token),
		},
	}
	const signDoc = cosmAmino.makeSignDoc([jsonTx], fee, chainId, memo, accountNumber, sequence)
	return signDoc
}

export type Adr036Signer = {
	type: "adr036"
	getAddress: (chainId: string) => Promise<string>
	getChainId: () => Promise<string>
	signMessage: (
		msg: any,
		fee: any,
	) => Promise<{
		public_key: string
		signature: string
	}>
}

export const createAdr036Signer = (signer: Adr036Signer) => ({
	getAddress: signer.getAddress,
	getChainId: signer.getChainId,
	sign: async (message: CosmosMessage) => {
		const { msgs, fee } = getADR036SignableSession(cbor.encode(message), message.address)
		const res = await signer.signMessage(msgs, fee)
		return { ...res, signatureType: "adr036" as const }
	},
})

export const verifyAdr036 = (message: CosmosMessage, sessionData: Adr036SignedSessionData) => {
	const signDoc = getADR036SignableSession(cbor.encode(message), message.address)

	const hash = sha256(cosm.serializeSignDoc(signDoc))
	if (!secp256k1.verify(sessionData.signature, hash, sessionData.public_key)) throw Error("invalid signature")
}

export type Adr036SignedSessionData = Awaited<ReturnType<ReturnType<typeof createAdr036Signer>["sign"]>>
