import type { Signature } from "@canvas-js/signed-cid"

import type { IPLDValue } from "./values.js"

export type SignedMessage<Payload extends IPLDValue = IPLDValue> = { signature: Signature; message: Message<Payload> }

export type Message<Payload extends IPLDValue = IPLDValue> = {
	clock: number
	parents: Uint8Array[]
	payload: Payload
}
