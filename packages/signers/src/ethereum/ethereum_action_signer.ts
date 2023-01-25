import { ethers } from "ethers"
import { Action, ActionPayload } from "@canvas-js/interfaces"
import { signAction } from "@canvas-js/chain-ethereum"
import { ActionSigner } from "../interfaces.js"

export class EthereumActionSigner implements ActionSigner {
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
		return signAction(this.wallet, payload, payload.from === this.wallet.address ? null : this.wallet.address)
	}
}
