import type { Chain, ChainId } from "@canvas-js/interfaces"

import { getCanvasSessionKey } from "./utils.js"

export type SessionObject = { app: string; sessionPrivateKey: string; expiration: number }

function isSessionObject(obj: any): obj is SessionObject {
	return (
		typeof obj === "object" &&
		typeof obj.app === "string" &&
		typeof obj.sessionPrivateKey === "string" &&
		typeof obj.expiration === "number"
	)
}

export function getSessionObject(chain: Chain, chainId: ChainId, signerAddress: string): SessionObject | null {
	const sessionKey = getCanvasSessionKey(chain, chainId, signerAddress)
	const item = localStorage.getItem(sessionKey)
	if (item === null) {
		return null
	}

	let sessionObject: any
	try {
		sessionObject = JSON.parse(item)
	} catch (err) {
		localStorage.removeItem(sessionKey)
		return null
	}

	if (!isSessionObject(sessionObject)) {
		localStorage.removeItem(sessionKey)
		return null
	}

	return sessionObject
}

export function setSessionObject(chain: Chain, chainId: ChainId, signerAddress: string, sessionObject: SessionObject) {
	const sessionKey = getCanvasSessionKey(chain, chainId, signerAddress)
	localStorage.setItem(sessionKey, JSON.stringify(sessionObject))
}

export function removeSessionObject(chain: Chain, chainId: ChainId, signerAddress: string) {
	const sessionKey = getCanvasSessionKey(chain, chainId, signerAddress)
	localStorage.removeItem(sessionKey)
}
