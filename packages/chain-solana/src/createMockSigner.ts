import * as solw3 from "@solana/web3.js"
import nacl from "tweetnacl"

export function createMockSolanaSigner() {
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
