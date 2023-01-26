import { ethers } from "ethers"

import type { Action, ActionArgument, ActionPayload, Session, SessionPayload } from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

export class TestSigner {
	readonly wallet = ethers.Wallet.createRandom()
	constructor(
		readonly uri: string,
		readonly appName: string,
		readonly chainImplementation: EthereumChainImplementation = new EthereumChainImplementation()
	) {}

	async sign(call: string, callArgs: Record<string, ActionArgument>): Promise<Action> {
		const actionPayload: ActionPayload = {
			from: this.wallet.address,
			app: this.uri,
			appName: this.appName,
			call,
			callArgs,
			timestamp: Date.now(),
			chain: "ethereum",
			chainId: "1",
			block: null,
		}

		if (this.chainImplementation.provider !== undefined) {
			const block = await this.chainImplementation.provider.getBlock("latest")
			actionPayload.block = block.hash
		}

		return this.chainImplementation.signAction(this.wallet, actionPayload)
	}
}

export class TestSessionSigner {
	readonly wallet = ethers.Wallet.createRandom()
	constructor(readonly signer: TestSigner) {}

	async session(): Promise<Session> {
		const sessionPayload: SessionPayload = {
			sessionAddress: this.wallet.address,
			sessionDuration: 60 * 60 * 24 * 1000,
			sessionIssued: Date.now(),
			from: this.signer.wallet.address,
			app: this.signer.uri,
			appName: this.signer.appName,
			chain: "ethereum",
			chainId: "1",
			block: null,
		}

		if (this.signer.chainImplementation.provider !== undefined) {
			const block = await this.signer.chainImplementation.provider.getBlock("latest")
			sessionPayload.block = block.hash
		}

		return await this.signer.chainImplementation.signSession(this.signer.wallet, sessionPayload)
	}

	async sign(call: string, callArgs: Record<string, ActionArgument>): Promise<Action> {
		const actionPayload: ActionPayload = {
			from: this.signer.wallet.address,
			app: this.signer.uri,
			appName: this.signer.appName,
			call,
			callArgs,
			timestamp: Date.now(),
			chain: "ethereum",
			chainId: "1",
			block: null,
		}

		if (this.signer.chainImplementation.provider !== undefined) {
			const block = await this.signer.chainImplementation.provider.getBlock("latest")
			actionPayload.block = block.hash
		}

		return await this.signer.chainImplementation.signDelegatedAction(this.wallet, actionPayload)
	}
}
