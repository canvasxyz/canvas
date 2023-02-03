import * as solw3 from "@solana/web3.js"
import nacl from "tweetnacl"
import { WalletMock } from "@canvas-js/interfaces"
import { SolanaChainImplementation } from "./implementation.js"

export class SolanaWalletMock implements WalletMock<SolanaChainImplementation> {
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
