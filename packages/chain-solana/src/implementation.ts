import solw3 from "@solana/web3.js"
import nacl from "tweetnacl"
import bs58 from "bs58"

import type {
	Action,
	ActionPayload,
	Chain,
	ChainId,
	ChainImplementation,
	Session,
	SessionPayload,
} from "@canvas-js/interfaces"
import { serializeActionPayload, serializeSessionPayload } from "@canvas-js/interfaces"

const getActionSignatureData = (payload: ActionPayload): Uint8Array => {
	return new TextEncoder().encode(serializeActionPayload(payload))
}
const getSessionSignatureData = (payload: SessionPayload): Uint8Array => {
	return new TextEncoder().encode(serializeSessionPayload(payload))
}

// Solana doesn't publish TypeScript signatures for injected wallets, but we can assume
// most wallets expose a Phantom-like API and use their injected `window.solana` objects directly:
// https://github.com/solana-labs/wallet-adapter/commit/5a274e0a32c55d4376d63a802f0d512947b087af
interface SolanaWindowSigner {
	isPhantom?: boolean
	publicKey?: { toBytes(): Uint8Array }
	isConnected: boolean
	signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
	connect(): Promise<void>
	disconnect(): Promise<void>
	_handleDisconnect(...args: unknown[]): unknown
}

/**
 * Solana chain export.
 */
export class SolanaChainImplementation implements ChainImplementation<SolanaWindowSigner, solw3.Keypair> {
	public readonly chain: Chain = "solana"

	constructor(public readonly chainId: ChainId = "mainnet") {}

	hasProvider() {
		return false
	}

	async verifyAction(action: Action): Promise<void> {
		const expectedAddress = action.session ?? action.payload.from
		const message = getActionSignatureData(action.payload)
		const signatureBytes = bs58.decode(action.signature)
		const valid = nacl.sign.detached.verify(message, signatureBytes, bs58.decode(expectedAddress))
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	async verifySession(session: Session): Promise<void> {
		const expectedAddress = session.payload.from
		const message = getSessionSignatureData(session.payload)
		const signatureBytes = bs58.decode(session.signature)
		const valid = nacl.sign.detached.verify(message, signatureBytes, bs58.decode(expectedAddress))
		if (!valid) {
			throw new Error("Invalid action signature")
		}
	}

	getSignerAddress = async (signer: SolanaWindowSigner) => {
		if (signer.publicKey === null || signer.publicKey === undefined) throw new Error("Wallet not connected")
		return bs58.encode(signer.publicKey.toBytes())
	}
	getDelegatedSignerAddress = async (wallet: solw3.Keypair) => bs58.encode(wallet.publicKey.toBytes())

	async signSession(signer: SolanaWindowSigner, payload: SessionPayload): Promise<Session> {
		if (signer.publicKey === null || signer.publicKey === undefined) throw new Error("Wallet not connected")
		const address = bs58.encode(signer.publicKey.toBytes())
		const message = getSessionSignatureData(payload)
		const { signature: signatureBytes } = await signer.signMessage(message)

		return { type: "session", payload, signature: bs58.encode(signatureBytes) }
	}

	async signAction(signer: SolanaWindowSigner, payload: ActionPayload): Promise<Action> {
		if (signer.publicKey === null || signer.publicKey === undefined) throw new Error("Wallet not connected")
		const address = bs58.encode(signer.publicKey.toBytes())
		if (address !== payload.from) {
			throw new Error("Signer address did not match payload.from")
		}
		const message = getActionSignatureData(payload)
		const { signature: signatureBytes } = await signer.signMessage(message)

		return { type: "action", payload: payload, session: null, signature: bs58.encode(signatureBytes) }
	}

	async signDelegatedAction(wallet: solw3.Keypair, payload: ActionPayload) {
		const message = getActionSignatureData(payload)
		const signatureBytes = nacl.sign.detached(message, wallet.secretKey)
		const signature = bs58.encode(signatureBytes)
		const action: Action = {
			type: "action",
			payload: payload,
			session: bs58.encode(wallet.publicKey.toBytes()),
			signature,
		}
		return action
	}

	importDelegatedSigner = (secretKey: string) => solw3.Keypair.fromSecretKey(bs58.decode(secretKey))
	exportDelegatedSigner = (wallet: solw3.Keypair) => bs58.encode(wallet.secretKey)
	generateDelegatedSigner = async (): Promise<solw3.Keypair> => solw3.Keypair.generate()

	async getLatestBlock(): Promise<string> {
		throw new Error("Unimplemented")
	}
}
