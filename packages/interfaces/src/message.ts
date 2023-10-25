import type { Signature } from "@canvas-js/signed-cid"

export type Message<Payload = unknown> = {
	topic: string
	clock: number
	parents: string[]
	payload: Payload
}

export interface MessageSigner<Payload = unknown> {
	sign: (message: Message<Payload>) => Signature
}
