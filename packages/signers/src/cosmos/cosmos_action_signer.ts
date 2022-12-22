import { Action, ActionPayload, makeActionToken } from "@canvas-js/interfaces"
import { ActionSigner } from "../interfaces.js"

import { bech32 } from "bech32"

import { Secp256k1HdWallet } from "@cosmjs/amino"
import { validationTokenToSignDoc } from "@canvas-js/verifiers"

export class CosmosActionSigner implements ActionSigner {
	wallet: Secp256k1HdWallet
	cosmosAddress: string
	bech32Prefix: string

	constructor(wallet: Secp256k1HdWallet, cosmosAddress: string, bech32Prefix: string) {
		this.wallet = wallet
		this.cosmosAddress = cosmosAddress
		this.bech32Prefix = bech32Prefix
	}
	get address(): string {
		const { prefix, words } = bech32.decode(this.cosmosAddress)
		const chainAddress = bech32.encode(this.bech32Prefix, words)
		return chainAddress
	}
	get privateKey(): string {
		return this.wallet.mnemonic
	}
	async signActionPayload(payload: ActionPayload): Promise<Action> {
		const actionToken = makeActionToken(payload)
		const generatedSignDoc = validationTokenToSignDoc(Buffer.from(JSON.stringify(actionToken)), this.address)
		const { signature } = await this.wallet.signAmino(this.cosmosAddress, generatedSignDoc)
		return { signature: JSON.stringify(signature), payload, session: this.address, type: "action" }
	}
}
