import bech32 from "bech32"
import * as ethUtil from "@ethereumjs/util"

import { Action, Session } from "packages/interfaces/lib"
import { verifyCosmosActionSignature } from "./verify_cosmos.js"

type ChainSettings = {
	bech32_prefix: string
}

const cosmosChainSettings = {
	"evmos_9001-2": {
		bech32_prefix: "evmos",
	},
} as { [key: string]: ChainSettings }

export const verifyEvmosActionSignature = (action: Action) => {
	return verifyCosmosActionSignature(action)
}

export const verifyEvmosSessionSignature = (session: Session) => {
	//
	// ethereum address handling on cosmos chains via metamask
	//

	const msgBuffer = Buffer.from(JSON.stringify(session.payload))
	const expectedAddress = session.payload.from

	// toBuffer() doesn't work if there is a newline
	const msgHash = ethUtil.hashPersonalMessage(msgBuffer)
	const ethSignatureParams = ethUtil.fromRpcSig(session.signature.trim())
	const publicKey = ethUtil.ecrecover(msgHash, ethSignatureParams.v, ethSignatureParams.r, ethSignatureParams.s)

	const addressBuffer = ethUtil.publicToAddress(publicKey)
	const lowercaseAddress = ethUtil.bufferToHex(addressBuffer)

	const chain = cosmosChainSettings[session.payload.chainId]

	try {
		// const ethAddress = Web3.utils.toChecksumAddress(lowercaseAddress);
		const b32AddrBuf = ethUtil.Address.fromString(lowercaseAddress.toString()).toBuffer()
		const b32Address = bech32.encode(chain.bech32_prefix, bech32.toWords(b32AddrBuf))

		if (expectedAddress === b32Address) {
			return expectedAddress
		}
	} catch (e) {
		console.log(e)
	}
	return ""
}
