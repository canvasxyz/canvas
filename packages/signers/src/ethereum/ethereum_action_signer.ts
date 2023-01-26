import { ethers } from "ethers"
import { Action, ActionPayload } from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { ActionSigner } from "../interfaces.js"

const { signAction, signDelegatedAction } = new EthereumChainImplementation()

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
			return signAction(this.wallet, payload)
		} else {
			return signDelegatedAction(this.wallet, payload)
		}
	}
}
