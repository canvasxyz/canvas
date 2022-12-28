import type { Action, ActionArgument, ActionPayload, Session, SessionPayload } from "@canvas-js/interfaces"
import { EthereumBlockProvider } from "@canvas-js/signers"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/verifiers"
import { ethers } from "ethers"

export class TestSigner {
	readonly wallet = ethers.Wallet.createRandom()
	constructor(readonly uri: string, readonly provider?: EthereumBlockProvider) {}

	async sign(call: string, args: Record<string, ActionArgument>): Promise<Action> {
		const actionPayload: ActionPayload = {
			from: this.wallet.address,
			spec: this.uri,
			call,
			args,
			timestamp: Date.now(),
			chain: "eth",
			chainId: 1,
			blockhash: null,
		}

		if (this.provider !== undefined) {
			const block = await this.provider.getBlock("latest")
			actionPayload.blockhash = block.blockhash
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
			address: this.wallet.address,
			duration: 60 * 60 * 24,
			from: this.signer.wallet.address,
			spec: this.signer.uri,
			timestamp: Date.now(),
			chain: "eth",
			chainId: 1,
			blockhash: null,
		}

		if (this.signer.provider !== undefined) {
			const block = await this.signer.provider.getBlock("latest")
			sessionPayload.blockhash = block.blockhash
		}

		const sessionSignatureData = getSessionSignatureData(sessionPayload)
		const sessionSignature = await this.signer.wallet._signTypedData(...sessionSignatureData)
		return { type: "session", payload: sessionPayload, signature: sessionSignature }
	}

	async sign(call: string, args: Record<string, ActionArgument>): Promise<Action> {
		const actionPayload: ActionPayload = {
			from: this.signer.wallet.address,
			spec: this.signer.uri,
			call,
			args,
			timestamp: Date.now(),
			chain: "eth",
			chainId: 1,
			blockhash: null,
		}

		if (this.signer.provider !== undefined) {
			const block = await this.signer.provider.getBlock("latest")
			actionPayload.blockhash = block.blockhash
		}

		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await this.wallet._signTypedData(...actionSignatureData)
		return { type: "action", payload: actionPayload, session: this.wallet.address, signature: actionSignature }
	}
}
