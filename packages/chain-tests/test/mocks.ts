import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { SolanaChainImplementation } from "@canvas-js/chain-solana"
import { ChainImplementation } from "@canvas-js/interfaces"
import { Wallet } from "ethers"
import * as solw3 from "@solana/web3.js"
import nacl from "tweetnacl"

export interface WalletMock<CI extends ChainImplementation> {
	createSigner: () => Parameters<CI["getSignerAddress"]>[0]
}
typeof EthereumChainImplementation

export class EthereumWalletMock implements WalletMock<EthereumChainImplementation> {
	createSigner() {
		return Wallet.createRandom()
	}
}

export class SolanaMock implements WalletMock<SolanaChainImplementation> {
	createSigner() {
		const keypair = solw3.Keypair.generate()

		return {
			isPhantom: true,
			isConnected: true,
			connect: async () => {},
			disconnect: async () => {},
			publicKey: { toBytes: () => keypair.publicKey.toBytes() },
			signMessage: async (message: Uint8Array) => {
				const signatureBytes = nacl.sign.detached(message, keypair.secretKey)
				return { signature: signatureBytes }
			},
			_handleDisconnect: (...args: unknown[]) => {},
		}
	}
}
