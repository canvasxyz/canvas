import { ethers } from "ethers"
import type { TypedDataSigner, Signer } from "@ethersproject/abstract-signer"
import type { ActionPayload, Chain, ChainId, ChainImplementation } from "@canvas-js/interfaces"

import { verifyAction, verifySession } from "./verify.js"
import { signAction, signSession } from "./sign.js"

export class EthereumChainImplementation implements ChainImplementation<TypedDataSigner & Signer, ethers.Wallet> {
	public readonly chain: Chain = "ethereum"

	constructor(public readonly chainId: ChainId = "1", public readonly provider?: ethers.providers.JsonRpcProvider) {}

	verifyAction = verifyAction
	verifySession = verifySession
	signSession = signSession

	getSignerAddress = async (signer: TypedDataSigner & Signer) => signer.getAddress()
	getDelegatedSignerAddress = async (wallet: ethers.Wallet) => wallet.address

	isSigner(signer: unknown): signer is TypedDataSigner & ethers.Signer {
		return signer instanceof ethers.Wallet || signer instanceof ethers.providers.JsonRpcSigner
	}

	isDelegatedSigner(delegatedSigner: unknown): delegatedSigner is ethers.Wallet {
		return delegatedSigner instanceof ethers.Wallet
	}

	signAction = (signer: TypedDataSigner & Signer, payload: ActionPayload) => signAction(signer, payload, null)
	signDelegatedAction = (wallet: ethers.Wallet, payload: ActionPayload) => signAction(wallet, payload, wallet.address)
	importDelegatedSigner = (privateKey: string) => new ethers.Wallet(privateKey)
	exportDelegatedSigner = (wallet: ethers.Wallet) => wallet.privateKey
	async generateDelegatedSigner(): Promise<ethers.Wallet> {
		return ethers.Wallet.createRandom()
	}

	async getLatestBlock(): Promise<string> {
		if (this.provider !== undefined) {
			const block = await this.provider.getBlock("latest")
			return block.hash
		} else {
			throw new Error("Cannot get latest block: no JsonRpcProvider provided")
		}
	}
}
