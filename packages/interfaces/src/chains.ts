import type { Action, ActionPayload } from "./actions.js"
import type { Session, SessionPayload } from "./sessions.js"

export interface ChainImplementation<Signer, DelegatedSigner> {
	match(chain: string, chainId: string): boolean

	verifyAction(action: Action): Promise<void>
	verifySession(session: Session): Promise<void>

	importDelegatedSigner(session: Session, privateKey: string): DelegatedSigner
	exportDelegatedSigner(session: Session, wallet: DelegatedSigner): string

	generateDelegatedSigner(): Promise<[address: string, wallet: DelegatedSigner]>

	signSession(signer: Signer, payload: SessionPayload): Promise<Session>
	signAction(signer: Signer, payload: ActionPayload): Promise<Action>
	signDelegatedAction(signer: DelegatedSigner, payload: ActionPayload): Promise<Action>
}
