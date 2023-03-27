import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex } from "@noble/hashes/utils"

import type { Session } from "./sessions.js"
import type { Action } from "./actions.js"

import type { CustomAction } from "./customActions.js"

import { stringify } from "./stringify.js"

export type Message = Action | Session | CustomAction

export function serializeMessage(message: Message) {
	return stringify(message)
}

export function getMessageHash(message: Message): string {
	const hash = sha256(stringify(message))
	return "0x" + bytesToHex(hash)
}
