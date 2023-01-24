import type { Action, ActionArgument, ActionPayload, Session, SessionPayload } from "@canvas-js/interfaces"
import { EthereumBlockProvider } from "@canvas-js/verifiers"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/verifiers"
import { ethers } from "ethers"

export class TestSigner {
	readonly wallet = ethers.Wallet.createRandom()
	constructor(readonly uri: string, readonly appName: string, readonly provider?: EthereumBlockProvider) {}

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

		if (this.provider !== undefined) {
			const block = await this.provider.getBlock("latest")
			actionPayload.block = block.blockhash
		}

		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await this.wallet._signTypedData(...actionSignatureData)
		return { type: "action", payload: actionPayload, session: null, signature: actionSignature }
	}
}

export class TestSessionSigner {
	readonly wallet = ethers.Wallet.createRandom()
	constructor(readonly signer: TestSigner) {}

	async session(): Promise<Session> {
		const sessionPayload: SessionPayload = {
			sessionAddress: this.wallet.address,
			sessionDuration: 60 * 60 * 24,
			sessionIssued: Date.now(),
			from: this.signer.wallet.address,
			app: this.signer.uri,
			appName: this.signer.appName,
			chain: "ethereum",
			chainId: "1",
			block: null,
		}

		if (this.signer.provider !== undefined) {
			const block = await this.signer.provider.getBlock("latest")
			sessionPayload.block = block.blockhash
		}

		const sessionSignatureData = getSessionSignatureData(sessionPayload)
		const sessionSignature = await this.signer.wallet._signTypedData(...sessionSignatureData)
		return { type: "session", payload: sessionPayload, signature: sessionSignature }
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

		if (this.signer.provider !== undefined) {
			const block = await this.signer.provider.getBlock("latest")
			actionPayload.block = block.blockhash
		}

		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await this.wallet._signTypedData(...actionSignatureData)
		return { type: "action", payload: actionPayload, session: this.wallet.address, signature: actionSignature }
	}
}
