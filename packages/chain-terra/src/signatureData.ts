import { configure } from "safe-stable-stringify"
import type { AminoMsg, StdSignDoc, StdFee } from "@cosmjs/amino"
import { makeSignDoc } from "@cosmjs/amino"

const jsonStableStringify = configure({ circularValue: Error, bigint: false, deterministic: true, strict: true })

export const makeArbitraryStdSignDoc = async (data: any, address: string): Promise<StdSignDoc> => {
	const accountNumber = 0
	const sequence = 0
	const chainId = ""
	const fee: StdFee = {
		gas: "0",
		amount: [],
	}
	const memo = ""

	const jsonTx: AminoMsg = {
		type: "sign/MsgSignData",
		value: {
			signer: address,
			data: jsonStableStringify(data),
		},
	}
	const signDoc = makeSignDoc([jsonTx], fee, chainId, memo, accountNumber, sequence)
	return signDoc
}

export const getActionSignatureData = async (actionPayload: any, address: string): Promise<StdSignDoc> => {
	return makeArbitraryStdSignDoc(actionPayload, address)
}

export const getSessionSignatureData = async (sessionPayload: any, address: string): Promise<StdSignDoc> => {
	return makeArbitraryStdSignDoc(sessionPayload, address)
}
