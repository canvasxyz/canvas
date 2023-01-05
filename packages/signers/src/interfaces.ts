import { Action, ActionPayload, Block, Chain, ChainId, Session, SessionPayload } from "@canvas-js/interfaces"

export interface Connector {
	id: string
	available: boolean
	enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void>
	disable(): void
	createSessionSigner(account: string): Promise<SessionSigner>
	label: string
}

export interface SessionSigner {
	getAddress(): Promise<string>
	createActionSigner(sessionPrivateKey?: string): Promise<ActionSigner>
	signSessionPayload(payload: SessionPayload): Promise<Session>
	getChain(): Promise<Chain>
	getChainId(): Promise<ChainId>
	getRecentBlock(): Promise<Block>
}

export interface ActionSigner {
	address: string
	privateKey: string
	signActionPayload(payload: ActionPayload): Promise<Action>
}
