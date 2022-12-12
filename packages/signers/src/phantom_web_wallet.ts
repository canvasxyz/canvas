import { Action, ActionPayload, Block } from "packages/interfaces/lib/actions.js"
import { Chain, ChainId } from "packages/interfaces/lib/contracts.js"
import { SessionPayload, Session } from "packages/interfaces/lib/sessions.js"
import { Connector, SessionSigner, ActionSigner } from "./interfaces.js"
import nacl from "tweetnacl"

import { Buffer } from "buffer"

declare let window: any

import * as solw3 from "@solana/web3.js"

export class PhantomWebWalletConnector implements Connector {
	public readonly label = "Phantom"

	constructor() {}

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
	async createActionSigner(sessionPrivateKey?: string | undefined): Promise<ActionSigner> {
		const keypair = sessionPrivateKey
			? solw3.Keypair.fromSecretKey(Buffer.from(sessionPrivateKey, "hex"))
			: solw3.Keypair.generate()

		return new PhantomWebWalletActionSigner(keypair)
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

export class PhantomWebWalletActionSigner implements ActionSigner {
	keypair: solw3.Keypair
	constructor(keypair: solw3.Keypair) {
		this.keypair = keypair
	}
	get address(): string {
		return this.keypair.publicKey.toBase58()
	}
	get privateKey(): string {
		return Buffer.from(this.keypair.secretKey).toString("hex")
	}
	async signActionPayload(payload: ActionPayload): Promise<Action> {
		const signature = nacl.sign.detached(Buffer.from(JSON.stringify(payload)), this.keypair.secretKey)
		const signatureB64 = Buffer.from(signature as Uint8Array).toString("base64")
		return { signature: signatureB64, payload: payload, session: this.address }
	}
}
