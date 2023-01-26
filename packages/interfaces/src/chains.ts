import type { Chain, ChainId } from "./contracts.js"
import type { Action, ActionPayload } from "./actions.js"
import type { Session, SessionPayload } from "./sessions.js"

export interface ChainImplementation<Signer = unknown, DelegatedSigner = unknown> {
	chain: Chain
	chainId: ChainId
	// match(chain: string, chainId: string): boolean

	verifyAction(action: Action): Promise<void>
	verifySession(session: Session): Promise<void>

	isSigner(signer: unknown): signer is Signer
	isDelegatedSigner(delegatedSigner: unknown): delegatedSigner is DelegatedSigner

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
