import { Block } from "packages/interfaces/lib/actions.js"
import { Chain, ChainId } from "packages/interfaces/lib/contracts.js"
import { SessionPayload, Session } from "packages/interfaces/lib/sessions.js"
import { Connector, SessionSigner, ActionSigner } from "./interfaces.js"

import { Buffer } from "buffer"

declare let window: any

import * as solw3 from "@solana/web3.js"
import { EthereumActionSigner } from "./metamask_web_wallet.js"

export class PhantomWebWalletConnector implements Connector {
	id = "phantom"

	public readonly label = "Phantom"

	constructor() {}

	public get available() {
		return window.solana && window.solana.isPhantom
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		const available = window.solana && window.solana.isPhantom

		console.log("Attempting to enable Phantom")
		if (!available) {
			throw new Error("Phantom wallet not installed!")
		}
		let accounts
		try {
			const resp = await window.solana.connect()
			const key = resp.publicKey.toString() as string
			accounts = [key]
		} catch (err) {
			throw new Error("Could not connect to Phantom wallet!")
		}

		onAccountsChanged(accounts)
	}
	disable(): void {
		window.solana.disconnect()
	}
	async createSessionSigner(account: string): Promise<SessionSigner> {
		// TODO: What should the chain ID be here? Does it matter for Solana?
		return new PhantomWebWalletSessionSigner(account, "solana")
	}
}

export class PhantomWebWalletSessionSigner implements SessionSigner {
	address: string
	chain: Chain = "cosmos"
	chainId

	constructor(address: string, chainId: any) {
		this.address = address
		this.chainId = chainId
	}

	async getRecentBlock(): Promise<Block> {
		const connection = new solw3.Connection("https://api.devnet.solana.com")
		const slot = await connection.getSlot()
		const block = await connection.getBlock(slot)
		if (!block) {
			throw Error("Block was not returned by Solana API")
		}
		return {
			chain: "solana",
			chainId: this.chainId,
			blocknum: slot,
			blockhash: block.blockhash,
			timestamp: block.blockTime!,
		}
	}
	async getAddress(): Promise<string> {
		return this.address
	}
	async createActionSigner(sessionPrivateKey?: string): Promise<ActionSigner> {
		return new EthereumActionSigner(sessionPrivateKey)
	}
	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const { signature } = await window.solana.signMessage(Buffer.from(JSON.stringify(payload)), "utf8")
		const signedMessage = Buffer.from(signature as Uint8Array).toString("base64")
		return { signature: signedMessage, payload }
	}
	async getChain(): Promise<Chain> {
		return this.chain
	}
	async getChainId(): Promise<ChainId> {
		return this.chainId
	}
}
