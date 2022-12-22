import { Action, ActionPayload, Block, Chain, ChainId, Session, SessionPayload } from "@canvas-js/interfaces"

export interface Connector {
	id: string
	get available(): boolean
	enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void>
	disable(): void
	createSessionSigner(account: string): Promise<SessionSigner>
	label: string
}

export interface SessionSigner {
	getAddress(): Promise<string>
	createActionWallet(sessionPrivateKey?: string): Promise<ActionWallet>
	signSessionPayload(payload: SessionPayload): Promise<Session>
	getChain(): Promise<Chain>
	getChainId(): Promise<ChainId>
	getRecentBlock(): Promise<Block>
}

export interface ActionWallet {
	get address(): string
	get privateKey(): string
	signActionPayload(payload: ActionPayload): Promise<Action>
}
