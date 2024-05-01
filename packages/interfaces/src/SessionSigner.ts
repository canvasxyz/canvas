import type { Signer } from "./Signer.js"
import type { Session } from "./Session.js"
import type { Action } from "./Action.js"
import type { Awaitable } from "./Awaitable.js"
import { Signature } from "./Signature.js"
import { Message } from "./Message.js"

export interface AbstractSessionData {
	topic: string
	address: string
	publicKey: string
	timestamp: number
	duration: number | null
}

export interface SessionSigner<AuthorizationData = any> {
	codecs: string[]
	match: (address: string) => boolean
	verify: (signature: Signature, message: Message<Action | Session<AuthorizationData>>) => Awaitable<void>

	getAddress: () => Awaitable<string>
	newDelegateSigner: (topic: string, address: string) => Signer<Action | Session<AuthorizationData>>
	getDelegateSigner: (topic: string, address: string) => Signer<Action | Session<AuthorizationData>> | null

	newSession: (data: AbstractSessionData) => Awaitable<Session<AuthorizationData>>

	/**
	 * Verify that `session.data` authorizes `session.publicKey`
	 * to take actions on behalf of the user `${session.chain}:${session.address}`
	 */
	verifySession: (topic: string, session: Session<AuthorizationData>) => Awaitable<void>

	clear(topic: string): Awaitable<void>

	/**
	 * A unique identifier based on the signer's arguments, used to trigger React effects.
	 * This should not change unless user-provided arguments to the signers change.
	 *
	 * For example, the key for `new SIWESigner()` should always remain the same, even if
	 * a different burner wallet is generated on every call.
	 */
	key: string
}
