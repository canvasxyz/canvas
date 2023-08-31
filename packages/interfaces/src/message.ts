import type { Signature } from "@canvas-js/signed-cid"

export type SignedMessage<Payload = unknown> = {
	signature: Signature | null
	message: Message<Payload>
}

export type Message<Payload = unknown> = {
	clock: number
	parents: Uint8Array[]
	payload: Payload
}
