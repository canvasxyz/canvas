import type { TypedDataSigner, Signer as AbstractSigner } from "@ethersproject/abstract-signer"
import type { Action, ActionPayload, Session, SessionPayload } from "@canvas-js/interfaces"

import { getActionSignatureData, getSessionSignatureData } from "./signatureData.js"

export async function signAction(
	signer: AbstractSigner & TypedDataSigner,
	payload: ActionPayload,
	sessionAddress: string | null
): Promise<Action> {
	const address = await signer.getAddress()
	if (sessionAddress === null) {
		if (address !== payload.from) {
			throw new Error("Signer address did not match payload.from")
		}
	} else {
		if (address !== sessionAddress) {
			throw new Error("Signer address did not match session.payload.sessionAddress")
		}
	}

	const signatureData = getActionSignatureData(payload)
	const signature = await signer._signTypedData(...signatureData)

	return { type: "action", session: sessionAddress, signature, payload }
}

export async function signSession(signer: AbstractSigner & TypedDataSigner, payload: SessionPayload): Promise<Session> {
	const address = await signer.getAddress()
	if (payload.from !== address) {
		throw new Error("Signer address did not match payload.from")
	}

	const signatureData = getSessionSignatureData(payload)
	const signature = await signer._signTypedData(...signatureData)
	return { type: "session", signature, payload }
}
