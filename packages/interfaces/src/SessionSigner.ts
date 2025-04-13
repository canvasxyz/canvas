import type { SignatureScheme, Signer } from "./Signer.js"
import type { Session } from "./Session.js"
import type { Action } from "./Action.js"
import type { Snapshot } from "./Snapshot.js"
import type { Awaitable } from "./Awaitable.js"
import { MessageType } from "./MessageType.js"

export type DidIdentifier = `did:${string}`

export interface AbstractSessionData {
	topic: string
	did: DidIdentifier
	publicKey: string
	context: {
		timestamp: number
		duration: number | null
	}
}

export interface SessionSigner<AuthorizationData = any> {
	scheme: SignatureScheme<MessageType<AuthorizationData>>
	match: (did: DidIdentifier) => boolean

	isReadOnly: () => boolean
	getDid: () => Awaitable<DidIdentifier>
	getDidParts: () => number
	getAddressFromDid: (did: DidIdentifier) => string
	getCurrentTimestamp: () => number

	hasSession: (topic: string, did?: DidIdentifier) => boolean
	getSession: (
		topic: string,
		options?: { did?: DidIdentifier } | { address: string },
	) => Awaitable<{
		payload: Session<AuthorizationData>
		signer: Signer<MessageType<AuthorizationData>>
	} | null>
	newSession: (topic: string) => Awaitable<{
		payload: Session<AuthorizationData>
		signer: Signer<MessageType<AuthorizationData>>
	}>

	/**
	 * Request a signature from the signer's Wallet, and use it to return a session.
	 */
	authorize(data: AbstractSessionData, authorizationData?: AuthorizationData): Awaitable<Session<AuthorizationData>>

	/**
	 * Verify that `session.data` authorizes `session.publicKey` to take actions on behalf of the user `session.did`.
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
