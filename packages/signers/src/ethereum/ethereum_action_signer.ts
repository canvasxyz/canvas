import { ethers } from "ethers"
import { Action, ActionPayload } from "@canvas-js/interfaces"
import ethereum from "@canvas-js/chain-ethereum"
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
		if (payload.from === this.wallet.address) {
			return ethereum.signAction(this.wallet, payload)
		} else {
			return ethereum.signDelegatedAction(this.wallet, payload)
		}
	}
}
