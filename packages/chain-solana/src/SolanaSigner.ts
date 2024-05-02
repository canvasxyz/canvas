import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"

import { ed25519 } from "@noble/curves/ed25519"

import type { Session, AbstractSessionData } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 as Ed25519SignatureScheme } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { validateSessionData, addressPattern, parseAddress } from "./utils.js"
import { SolanaMessage, SolanaSessionData } from "./types.js"

// Tested against Phantom SIWS: https://github.com/phantom/sign-in-with-solana
export const encodeSolanaMessage = (message: SolanaMessage) => {
	return new TextEncoder().encode(`This website wants you to sign in with your Solana account:
${message.address}

Allow it to read and write to the application on your behalf?

URI: ${message.topic}
Version: 1
Chain ID: mainnet
Issued At: ${message.issuedAt}
Expiration Time: ${message.expirationTime}
Resources:
- ${message.publicKey}`)
}

// Solana doesn't publish TypeScript signatures for injected wallets, but we can assume
// most wallets expose a Phantom-like API and use their injected `window.solana` objects directly:
// https://github.com/solana-labs/wallet-adapter/commit/5a274e0a32c55d4376d63a802f0d512947b087af
interface SolanaWindowSigner {
	publicKey?: solw3.PublicKey
	signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

export interface SolanaSignerInit {
	chainId?: string
	signer?: SolanaWindowSigner
	sessionDuration?: number
}

type GenericSigner = {
	address: string
	sign: (msg: Uint8Array) => Promise<Uint8Array>
}

export class SolanaSigner extends AbstractSessionSigner<SolanaSessionData> {
	public readonly match = (chain: string) => addressPattern.test(chain)
	public readonly chainId: string

	#signer: GenericSigner

	public constructor({ signer, sessionDuration, chainId }: SolanaSignerInit = {}) {
		super("chain-solana", Ed25519SignatureScheme, { sessionDuration })

		if (signer) {
			if (!signer.publicKey) {
				throw new Error("Invalid signer")
			}

			this.#signer = {
				address: base58btc.baseEncode(signer.publicKey.toBytes()),
				sign: async (msg) => {
					const { signature } = await signer.signMessage(msg)
					return signature
				},
			}
		} else {
			const privateKey = ed25519.utils.randomPrivateKey()
			const publicKey = ed25519.getPublicKey(privateKey)
			this.#signer = {
				address: base58btc.baseEncode(publicKey),
				sign: async (msg) => ed25519.sign(msg, privateKey),
			}
		}

		// 5ey... is the solana mainnet genesis hash
		this.chainId = chainId ?? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
	}

	public verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session
		assert(validateSessionData(data), "invalid session")

		const [_, walletAddress] = parseAddress(address)

		const message: SolanaMessage = {
			address: walletAddress,
			topic,
			publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const signingPublicKey = base58btc.baseDecode(walletAddress)

		const valid = ed25519.verify(data.signature, encodeSolanaMessage(message), signingPublicKey)
		// get the address who signed this, this is solana specific?
		assert(valid, "invalid signature")
	}

	public getAddress(): string {
		const walletAddress = this.#signer.address
		return `solana:${this.chainId}:${walletAddress}`
	}

	public async authorize(data: AbstractSessionData): Promise<Session<SolanaSessionData>> {
		const { topic, address, publicKey, timestamp, duration } = data

		const issuedAt = new Date(timestamp)

		const [_, walletAddress] = parseAddress(address)

		const message: SolanaMessage = {
			address: walletAddress,
			topic,
			publicKey: publicKey,
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (duration !== null) {
			const expirationTime = new Date(timestamp + duration)
			message.expirationTime = expirationTime.toISOString()
		}

		const signature = await this.#signer.sign(encodeSolanaMessage(message))

		return {
			type: "session",
			address: address,
			publicKey: publicKey,
			authorizationData: { signature },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}
	}
}
