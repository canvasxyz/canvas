import type { AminoMsg, StdFee } from "@cosmjs/amino"
import { makeSignDoc } from "@cosmjs/amino"
import { toBase64 } from "@cosmjs/encoding"

export const getSessionSignatureData = (sessionPayload: Uint8Array, address: string, chain_id?: string) => {
	const accountNumber = 0
	const sequence = 0
	const chainId = chain_id ?? ""
	const fee: StdFee = {
		gas: "0",
		amount: [],
	}
	const memo = ""

	const jsonTx: AminoMsg = {
		type: "sign/MsgSignData",
		value: {
			signer: address,
			data: toBase64(sessionPayload),
		},
	}
	const signDoc = makeSignDoc([jsonTx], fee, chainId, memo, accountNumber, sequence)
	return signDoc
}
