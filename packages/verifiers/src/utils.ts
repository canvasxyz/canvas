import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer"
import { SessionToken } from "packages/interfaces/lib"

export const TEST_BLOCK_INFO_STRING =
	'{"number":1,"hash":"0x0f927bde6fb00940895178da0d32948714ea6e76f6374f03ffbbd7e0787e15bf","timestamp":1665083987891}'

export const constructTypedCanvasMessage = (message: SessionToken) => {
	// construct the signature data from scratch, since canvas' implementation doesn't
	// include an EIP712Domain
	const domain: TypedDataDomain = {
		name: "Canvas",
	}

	const types: Record<string, TypedDataField[]> = {
		EIP712Domain: [{ name: "name", type: "string" }],
		Message: [
			{ name: "loginTo", type: "string" },
			{ name: "registerSessionAddress", type: "string" },
			{ name: "registerSessionDuration", type: "uint256" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	// canvas uses ethers' signTypedData types while commonwealth uses eth-sig-util's
	// so we have to coerce the types here
	return { types, primaryType: "Message", domain, message } as any
}
