import { ethers } from "ethers"
import { Action, ActionPayload } from "@canvas-js/interfaces"
import { getActionSignatureData } from "@canvas-js/verifiers"
import { ActionWallet } from "../interfaces.js"

export class EthereumActionWallet implements ActionWallet {
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
		return { type: "action", session: this.wallet.address, signature, payload }
	}
}
