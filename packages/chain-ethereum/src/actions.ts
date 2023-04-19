import { ethers, TypedDataDomain, TypedDataField } from "ethers"
import { TypedDataSigner } from "@ethersproject/abstract-signer"

import { ActionPayload } from "@canvas-js/interfaces"

import { configure } from "safe-stable-stringify"
import { verifyTypedData } from "@ethersproject/wallet"

const stringify = configure({ circularValue: Error, bigint: false, deterministic: true, strict: true })

/**
 * Ethereum compatible signer logic, used to generate and
 * verify EIP-712 signed data for wallets like Metamask.
 */

// "You should not pass the EIP712Domain into ethers. It will compute it for you."
// - https://github.com/ethers-io/ethers.js/issues/687
export const actionDataFields = {
	Message: [
		{ name: "app", type: "string" },
		{ name: "block", type: "string" },
		{ name: "call", type: "string" },
		{ name: "callArgs", type: "string" },
		{ name: "chain", type: "string" },
		{ name: "from", type: "string" },
		{ name: "timestamp", type: "uint64" },
	],
}

type SignatureData<PayloadType> = [TypedDataDomain, Record<string, TypedDataField[]>, PayloadType]

type ActionPayloadSignable = Omit<ActionPayload, "callArgs"> & { callArgs: string }

/**
 * gets EIP-712 signing data for an individual action
 */
export function getActionSignatureData(payload: ActionPayload): SignatureData<ActionPayloadSignable> {
	const domain = {
		name: payload.app,
	}

	// Rewrite fields with custom serializations. EIP-712 does not
	// accept null values as a type, so we replace the null blockhash
	// with an empty string
	const actionValue = {
		...payload,
		callArgs: stringify(payload.callArgs),
		block: payload.block || "",
	}

	return [domain, actionDataFields, actionValue]
}

/**
 * Sign an action. Supports both directly signing from your wallet,
 * and signing via a delegated session key.
 */
export async function signActionPayload(
	signer: ethers.Signer & TypedDataSigner,
	payload: ActionPayload
): Promise<string> {
	const signatureData = getActionSignatureData(payload)
	const signature = await signer._signTypedData(...signatureData)
	return signature
}

export async function verifyActionSignature(
	payload: ActionPayload,
	signature: string,
	session: string | null
): Promise<void> {
	const expectedAddress = session ?? payload.from
	const [domain, types, value] = getActionSignatureData(payload)
	const recoveredAddress = verifyTypedData(domain, types, value, signature)
	if (recoveredAddress !== expectedAddress) {
		throw new Error(`Invalid action signature: expected ${expectedAddress}, recovered ${recoveredAddress}`)
	}
}
