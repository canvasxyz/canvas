import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"
import * as json from "@ipld/dag-json"

import { ed25519 } from "@noble/curves/ed25519"

import type { Session } from "@canvas-js/interfaces"
import { AbstractSessionData, AbstractSessionSigner, Ed25519Signer } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { validateSessionData, addressPattern, parseAddress } from "./utils.js"
import { SolanaMessage, SolanaSessionData } from "./types.js"

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
	public readonly codecs = [Ed25519Signer.cborCodec, Ed25519Signer.jsonCodec]
	public readonly match = (chain: string) => addressPattern.test(chain)
	public readonly verify = Ed25519Signer.verify

	public readonly key: string
	public readonly sessionDuration: number | null
	public readonly chainId: string

	#signer: GenericSigner

	public constructor({ signer, sessionDuration, chainId }: SolanaSignerInit = {}) {
		super("chain-solana", { createSigner: (init) => new Ed25519Signer(init), defaultDuration: sessionDuration })

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
		this.chainId = chainId ?? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
		this.sessionDuration = sessionDuration ?? null
		this.key = `SolanaSigner-${signer ? "extension" : "burner"}`
	}

	public verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session
		assert(validateSessionData(data), "invalid session")

		const [_, walletAddress] = parseAddress(address)

		const message: SolanaMessage = {
			topic,
			publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const signingPublicKey = base58btc.baseDecode(walletAddress)

		const valid = ed25519.verify(data.signature, json.encode(message), signingPublicKey)
		// get the address who signed this, this is solana specific?
		assert(valid, "invalid signature")
	}

	protected getAddress(): string {
		const walletAddress = this.#signer.address
		return `${this.chainId}:${walletAddress}`
	}

	protected async newSession(data: AbstractSessionData): Promise<Session<SolanaSessionData>> {
		const { topic, address, publicKey, timestamp, duration } = data

		const issuedAt = new Date(timestamp)

		const message: SolanaMessage = {
			topic,
			publicKey: publicKey,
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (duration !== null) {
			console.log(issuedAt)
			const expirationTime = new Date(timestamp + duration)
			console.log(expirationTime)
			message.expirationTime = expirationTime.toISOString()
		}

		const signature = await this.#signer.sign(json.encode(message))

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
