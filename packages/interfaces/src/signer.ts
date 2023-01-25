import type { Action, ActionPayload } from "./actions.js"
import type { Session, SessionPayload } from "./sessions.js"

export interface Signer {
	signAction(payload: ActionPayload): Promise<Action>
	signSession(payload: SessionPayload): Promise<Session>
}

// export abstract class SessionManager {
// 	constructor(readonly signer: Signer) {}
// 	async signAction(payload: ActionPayload): Promise<Action> {}
// }

// export interface SessionManager {
// 	generateSessionSigner(): Promise<[address: string, signer: Signer]>
// }

// export interface SessionWallet {
// 	session: Session
// 	signAction(payload: ActionPayload): Promise<Action>
// }

// export interface Signer<Wallet, SessionWallet> {
// 	importSessionWallet(session: Session, privateKey: string): SessionWallet
// 	exportSessionWallet(session: Session, wallet: SessionWallet): string
// 	generateSessionWallet(): Promise<[address: string, wallet: SessionWallet]>

// 	signAction(wallet: Wallet, payload: ActionPayload, session: Session | null): Promise<Action>
// 	signSession(signer: SessionWallet, payload: SessionPayload): Promise<Session>
// }
