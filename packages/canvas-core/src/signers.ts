import { utils } from "ethers"
import { recoverTypedSignature, SignTypedDataVersion } from "@metamask/eth-sig-util"
import { verifyTypedData } from "@ethersproject/wallet"
import { TypedDataDomain, TypedDataField } from "@ethersproject/abstract-signer"

import type { ActionPayload, ActionArgument } from "./actions"
import type { SessionPayload } from "./sessions"

/**
 * Ethereum compatible signer logic, used to generate and
 * verify EIP-712 signed data for wallets like Metamask.
 *
 * `getActionSignaturePayload` gets EIP-712 signing data for an individual action
 * `verifyActionPayloadSignature` verifies an action signature matches a payload (does not check the payload)
 * `getSessionSignaturePayload` gets EIP-712 signing data to start a session
 * `verifySessionPayloadSignature` verifies a session signature matches a payload (does not check the payload)
 */

export const getActionSignaturePayload = (
	originAddress: string,
	multihash: string,
	timestamp: number,
	call: string,
	args: ActionArgument[]
): [TypedDataDomain, Record<string, TypedDataField[]>, object] => {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(originAddress), 32)),
	}

	const actionTypes = {
		Message: [
			{ name: "sendAction", type: "string" },
			{ name: "params", type: "string[]" },
			{ name: "application", type: "string" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	const actionValue = {
		sendAction: call,
		params: args.map((a: ActionArgument) => a?.toString()),
		application: multihash,
		timestamp: timestamp.toString(),
	}
	return [domain, actionTypes, actionValue]
}

export const verifyActionPayloadSignature = async (payload: ActionPayload, signature: string): Promise<string> => {
	const [domain, types, value] = getActionSignaturePayload(
		payload.from,
		payload.spec,
		payload.timestamp,
		payload.call,
		payload.args
	)
	return verifyTypedData(domain, types, value, signature)
}

export const getSessionSignaturePayload = (
	originAddress: string,
	multihash: string,
	timestamp: number,
	sessionSignerAddress: string,
	sessionDuration: number
): [TypedDataDomain, Record<string, TypedDataField[]>, object] => {
	const domain = {
		name: "Canvas",
		salt: utils.hexlify(utils.zeroPad(utils.arrayify(originAddress), 32)),
	}

	const sessionTypes = {
		Message: [
			{ name: "loginTo", type: "string" },
			{ name: "registerSessionKey", type: "string" },
			{ name: "registerSessionDuration", type: "uint256" },
			{ name: "timestamp", type: "uint256" },
		],
	}

	const sessionValue = {
		loginTo: multihash,
		registerSessionKey: sessionSignerAddress,
		registerSessionDuration: sessionDuration.toString(),
		timestamp: timestamp.toString(),
	}

	return [domain, sessionTypes, sessionValue]
}

export const verifySessionPayloadSignature = async (payload: SessionPayload, signature: string): Promise<string> => {
	const [domain, types, value] = getSessionSignaturePayload(
		payload.from,
		payload.spec,
		payload.timestamp,
		payload.session_public_key,
		payload.session_duration
	)
	return verifyTypedData(domain, types, value, signature)
}
