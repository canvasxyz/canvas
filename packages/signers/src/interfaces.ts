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
	getRecentBlock(): Promise<Block>
	getAddress(): Promise<string>
	createActionSigner(sessionPrivateKey?: string): Promise<ActionSigner>
	signSessionPayload(payload: SessionPayload): Promise<Session>
	getChain(): Promise<Chain>
	getChainId(): Promise<ChainId>
}

export interface ActionSigner {
	get address(): string
	get privateKey(): string
	signActionPayload(payload: ActionPayload): Promise<Action>
}
