import { Awaitable } from "./Awaitable.js"
import type { Message } from "./Message.js"
import type { Signature } from "./Signature.js"

export interface Signer<Payload = unknown> {
	uri: string // did:key URI
	codecs: string[]

	sign(message: Message<Payload>, options?: { codec?: string }): Awaitable<Signature>
	verify(signature: Signature, message: Message<Payload>): Awaitable<void>

	export(): { type: string; privateKey: Uint8Array }
}
