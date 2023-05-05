import { utils as nearApiUtils } from "near-api-js"
import nacl from "tweetnacl"

export function createMockNearSigner() {
	const keypair = nearApiUtils.KeyPairEd25519.fromRandom()

	return {
		isPhantom: true,
		isConnected: true,
		connect: async () => {},
		disconnect: async () => {},
		publicKey: { toBytes: () => keypair.getPublicKey().toString() },
		signMessage: async (message: Uint8Array) => {
			const { signature: signatureBytes } = keypair.sign(message)
			return { signature: signatureBytes }
		},
		_handleDisconnect: (...args: unknown[]) => {},
	}
}
