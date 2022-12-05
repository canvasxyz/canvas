import { Action, ActionPayload, Block, Chain, ChainId, Session, SessionPayload } from "@canvas-js/interfaces"

export interface Connector {
	enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void>
	disable(): void
	createSigner(account: string): Promise<Signer>
}

export interface Signer {
	getRecentBlock(): Promise<Block>
	getAddress(): Promise<string>
	createWallet(sessionPrivateKey?: string): Wallet
	signSessionPayload(payload: SessionPayload): Promise<Session>
	getChain(): Promise<Chain>
	getChainId(): Promise<ChainId>
}

export interface Wallet {
	get address(): string
	get privateKey(): string
	signActionPayload(payload: ActionPayload): Promise<Action>
}
