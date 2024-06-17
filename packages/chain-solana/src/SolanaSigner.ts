import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"

import { ed25519 } from "@noble/curves/ed25519"

import type { Awaitable, Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 as Ed25519SignatureScheme } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { validateSessionData, addressPattern, parseAddress } from "./utils.js"
import { SolanaMessage, SolanaSessionData } from "./types.js"

export const SOLANA_MAINNET_CHAIN_REF = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
export const SOLANA_TESTNET_CHAIN_REF = "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ"
export const SOLANA_DEVNET_CHAIN_REF = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1"

// Tested against Phantom SIWS: https://github.com/phantom/sign-in-with-solana
export const encodeSolanaMessage = (message: SolanaMessage) => {
	return new TextEncoder().encode(`This website wants you to sign in with your Solana account:
${message.address}

Allow it to read and write to the application on your behalf?

URI: ${message.topic}
Version: 1
Chain ID: ${message.chainId}
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
	signMessage(message: Uint8Array): Awaitable<{ signature: Uint8Array }>
}

export interface SolanaSignerInit {
	signer?: SolanaWindowSigner
	sessionDuration?: number
	chainId?: string
}

type GenericSigner = {
	address: string
	sign: (msg: Uint8Array) => Promise<Uint8Array>
}

export class SolanaSigner extends AbstractSessionSigner<SolanaSessionData> {
	public readonly match = (chain: string) => addressPattern.test(chain)
	public readonly chainId

	_signer: GenericSigner

	public constructor({ signer, sessionDuration, chainId }: SolanaSignerInit = {}) {
		super("chain-solana", Ed25519SignatureScheme, { sessionDuration })

		if (signer) {
			if (!signer.publicKey) {
				throw new Error("Invalid signer")
			}

			this._signer = {
				address: base58btc.baseEncode(signer.publicKey.toBytes()),
				sign: async (msg) => {
					const { signature } = await signer.signMessage(msg)
					return signature
				},
			}
		} else {
			const privateKey = ed25519.utils.randomPrivateKey()
			const publicKey = ed25519.getPublicKey(privateKey)
			this._signer = {
				address: base58btc.baseEncode(publicKey),
				sign: async (msg) => ed25519.sign(msg, privateKey),
			}
		}

		this.chainId = chainId ?? SOLANA_MAINNET_CHAIN_REF
	}

	public verifySession(topic: string, session: Session) {
		const {
			publicKey,
			did,
			authorizationData: data,
			context: { timestamp, duration },
		} = session
		assert(validateSessionData(data), "invalid session")

		const [chainId, walletAddress] = parseAddress(did)

		if (chainId !== this.chainId) {
			throw new Error("chain id did not match signer")
		}

		const message: SolanaMessage = {
			address: walletAddress,
			chainId,
			topic,
			publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === undefined ? null : new Date(timestamp + duration).toISOString(),
		}

		const signingPublicKey = base58btc.baseDecode(walletAddress)

		const valid = ed25519.verify(data.signature, encodeSolanaMessage(message), signingPublicKey)
		// get the address who signed this, this is solana specific?
		assert(valid, "invalid signature")
	}

	public getDid(): DidIdentifier {
		const walletAddress = this._signer.address
		return `did:pkh:solana:${this.chainId}:${walletAddress}`
	}

	public getDidParts(): number {
		return 5
	}

	public getAddressFromDid(did: DidIdentifier) {
		const [chainId, walletAddress] = parseAddress(did)
		return walletAddress
	}

	public async authorize(data: AbstractSessionData): Promise<Session<SolanaSessionData>> {
		const {
			topic,
			did,
			publicKey,
			context: { timestamp, duration },
		} = data

		const issuedAt = new Date(timestamp)

		const [chainId, walletAddress] = parseAddress(did)

		if (chainId !== this.chainId) {
			throw new Error("message chain id must match signer")
		}

		const message: SolanaMessage = {
			chainId,
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

		const signature = await this._signer.sign(encodeSolanaMessage(message))

		return {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData: { signature },
			context: this.sessionDuration
				? {
						timestamp,
						duration: this.sessionDuration,
					}
				: {
						timestamp,
					},
		}
	}
}
