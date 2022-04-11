import crypto from "node:crypto"
import assert from "node:assert"

export function getActionKey(signature: string): string {
	assert(signature.startsWith("0x"))
	const bytes = Buffer.from(signature.slice(2), "hex")
	const hash = crypto.createHash("sha256").update(bytes).digest("hex")
	return `a:${hash}`
}

export function getSessionKey(session_public_key: string): string {
	assert(session_public_key.startsWith("0x"))
	return `s:${session_public_key.slice(2)}`
}
