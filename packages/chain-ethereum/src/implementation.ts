import { ethers, Signer } from "ethers"
import { TypedDataSigner } from "@ethersproject/abstract-signer"

import type { Action, ActionPayload, ChainImplementation, Session, SessionPayload } from "@canvas-js/interfaces"

import { verifyActionSignature, signActionPayload } from "./actions.js"
import { signSessionPayload, verifySessionSignature } from "./sessions.js"

/**
 * Ethereum chain export.
 */
export class EthereumChainImplementation
	implements ChainImplementation<ethers.Signer & TypedDataSigner, ethers.Wallet>
{
	public static SiweMessageVersion = "1"
	public readonly chain: string
	constructor(
		public readonly chainId: number = 1,
		public readonly domain: string = "localhost",
		public readonly provider?: ethers.providers.JsonRpcProvider
	) {
		if (!Number.isSafeInteger(chainId)) {
			throw new Error(`Invalid eip155 chainId: ${chainId}`)
		}

		// https://github.com/ChainAgnostic/namespaces/blob/main/eip155/caip2.md
		this.chain = `eip155:${chainId}`
	}

	hasProvider() {
		return this.provider !== undefined
	}

	async verifyAction(action: Action): Promise<void> {
		if (action.payload.chain !== this.chain) {
			throw new Error("Invalid action.payload.chain")
		}

		await verifyActionSignature(action.payload, action.signature, action.session)
	}

	async verifySession(session: Session): Promise<void> {
		if (session.payload.chain !== this.chain) {
			throw new Error("Invalid session.payload.chain")
		}

		await verifySessionSignature(session.payload, session.signature)
	}

	async signSession(signer: ethers.Signer & TypedDataSigner, payload: SessionPayload): Promise<Session> {
		if (payload.chain !== this.chain) {
			throw new Error("Invalid payload.chain")
		}

		const signature = await signSessionPayload(signer, payload, this.domain)
		return { type: "session", signature, payload }
	}

	getSignerAddress = async (signer: ethers.Signer) => signer.getAddress()

	getDelegatedSignerAddress = async (wallet: ethers.Wallet) => wallet.address

	async signAction(signer: ethers.Signer & TypedDataSigner, payload: ActionPayload): Promise<Action> {
		const signature = await signActionPayload(signer, payload)
		return { type: "action", signature, session: null, payload }
	}

	async signDelegatedAction(wallet: ethers.Wallet, payload: ActionPayload): Promise<Action> {
		const signature = await signActionPayload(wallet, payload)
		return { type: "action", signature, session: wallet.address, payload }
	}

	importDelegatedSigner = (privateKey: string) => new ethers.Wallet(privateKey)

	exportDelegatedSigner = (wallet: ethers.Wallet) => wallet.privateKey

	async generateDelegatedSigner(): Promise<ethers.Wallet> {
		return ethers.Wallet.createRandom()
	}

	async getLatestBlock(): Promise<string> {
		if (this.provider !== undefined) {
			const block = await this.provider.getBlock("latest")
			if (block === null || block.hash === null) {
				throw new Error("Cannot get latest block")
			} else {
				return block.hash
			}
		} else {
			throw new Error("Cannot get latest block: no JsonRpcProvider provided")
		}
	}
}
