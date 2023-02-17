import type { Chain, ChainId } from "./contracts.js"
import type { Action, ActionPayload } from "./actions.js"
import type { Session, SessionPayload } from "./sessions.js"

/**
 * A `ChainImplementation` includes all the chain-specific cryptography and
 * signer management code.
 *
 * The regular signer may be a browser wallet, mobile wallet, or (in the future)
 * a Canvas-provided wallet derived in the browser from user-provided entropy.
 *
 * The delegated signer should be a wallet-like object holding a burner private key.
 */
export interface ChainImplementation<Signer = unknown, DelegatedSigner = unknown> {
	chain: Chain
	chainId: ChainId

	verifyAction(action: Action): Promise<void>
	verifySession(session: Session): Promise<void>

	getSignerAddress(signer: Signer): Promise<string>
	getDelegatedSignerAddress(delegatedSigner: DelegatedSigner): Promise<string>

	generateDelegatedSigner(): Promise<DelegatedSigner>
	importDelegatedSigner(privateKey: string): DelegatedSigner
	exportDelegatedSigner(delegatedSigner: DelegatedSigner): string

	signSession(signer: Signer, payload: SessionPayload): Promise<Session>
	signAction(signer: Signer, payload: ActionPayload): Promise<Action>
	signDelegatedAction(delegatedSigner: DelegatedSigner, payload: ActionPayload): Promise<Action>

	getLatestBlock(): Promise<string>
}
