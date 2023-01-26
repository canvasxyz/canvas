import { verifyTypedData } from "@ethersproject/wallet"

import type { Action, Session } from "@canvas-js/interfaces"

import { getActionSignatureData, getSessionSignatureData } from "./signatureData.js"

export async function verifyAction(action: Action) {
	const expectedAddress = action.session ?? action.payload.from
	const [domain, types, value] = getActionSignatureData(action.payload)
	const recoveredAddress = verifyTypedData(domain, types, value, action.signature)
	if (recoveredAddress !== expectedAddress) {
		throw new Error(`Invalid action signature: expected ${expectedAddress}, recovered ${recoveredAddress}`)
	}
}

export async function verifySession(session: Session) {
	const [domain, types, value] = getSessionSignatureData(session.payload)
	const recoveredAddress = verifyTypedData(domain, types, value, session.signature)
	if (recoveredAddress !== session.payload.from) {
		throw new Error(`Invalid session signature: expected ${session.payload.from}, recovered ${recoveredAddress}`)
	}
}
