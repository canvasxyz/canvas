import type { Signature } from "./Signature.js"
import type { Message } from "./Message.js"

export interface MessageSigner<Payload = unknown> {
	sign: (message: Message<Payload>) => Signature
}
