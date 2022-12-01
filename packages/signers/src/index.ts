import { ethers } from "ethers"
import {
	Action,
	ActionPayload,
	Block,
	getActionSignatureData,
	getSessionSignatureData,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"

export class Signer {
	signer: ethers.providers.JsonRpcSigner

	constructor(signer: ethers.providers.JsonRpcSigner) {
		this.signer = signer
	}

	async getRecentBlock(): Promise<Block> {
		const { provider } = this.signer
		const [network, providerBlock] = await Promise.all([provider.getNetwork(), provider.getBlock("latest")])

		return {
			chain: "eth",
			chainId: network.chainId,
			blocknum: providerBlock.number,
			blockhash: providerBlock.hash,
			timestamp: providerBlock.timestamp,
		}
	}

	async getAddress() {
		return this.signer.getAddress()
	}

	createWallet(sessionPrivateKey?: string): Wallet {
		const ethersWallet = sessionPrivateKey ? new ethers.Wallet(sessionPrivateKey) : ethers.Wallet.createRandom()
		return new Wallet(ethersWallet)
	}

	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const sessionSignatureData = getSessionSignatureData(payload)
		const signature = await this.signer._signTypedData(...sessionSignatureData)
		return { signature, payload }
	}
}

export class Wallet {
	wallet: ethers.Wallet

	constructor(wallet: ethers.Wallet) {
		this.wallet = wallet
	}

	get address(): string {
		return this.wallet.address
	}

	get privateKey(): string {
		return this.wallet.privateKey
	}

	async signActionPayload(payload: ActionPayload): Promise<Action> {
		const signatureData = getActionSignatureData(payload)
		const signature = await this.wallet._signTypedData(...signatureData)
		return { session: this.wallet.address, signature, payload }
	}
}
