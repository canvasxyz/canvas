import { Action, ActionPayload, Block, Session, SessionPayload } from "@canvas-js/interfaces"

export interface Connector<SignerClass extends Signer<any>> {
	enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): void
	createSigner(account: string): SignerClass
}

export interface Signer<WalletClass extends Wallet> {
	getRecentBlock(): Promise<Block>
	getAddress(): Promise<string>
	createWallet(sessionPrivateKey?: string): WalletClass
	signSessionPayload(payload: SessionPayload): Promise<Session>
}

export interface Wallet {
	get address(): string
	get privateKey(): string
	signActionPayload(payload: ActionPayload): Promise<Action>
}
