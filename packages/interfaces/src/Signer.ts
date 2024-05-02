import { Awaitable } from "./Awaitable.js"
import type { Message } from "./Message.js"
import type { Signature } from "./Signature.js"

export interface SignatureScheme<Payload = unknown> {
	type: string
	codecs: string[]
	verify: (signature: Signature, message: Message<Payload>) => Awaitable<void>
	create: (init?: { type: string; privateKey: Uint8Array }) => Signer<Payload>
}

export interface Signer<Payload = unknown> {
	scheme: SignatureScheme<Payload>

	publicKey: string // did:key URI

	sign(message: Message<Payload>, options?: { codec?: string }): Awaitable<Signature>

	export(): { type: string; privateKey: Uint8Array }
}
