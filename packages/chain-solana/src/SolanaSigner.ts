import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import { ed25519 } from "@noble/curves/ed25519"

import type { Signature, SessionSigner, Action, Message, Session, Heartbeat } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"

import target from "#target"

import { assert, signalInvalidType, validateSessionData, addressPattern, parseAddress } from "./utils.js"
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

export class SolanaSigner implements SessionSigner<SolanaSessionData> {
	public readonly sessionDuration: number | null
	public readonly chainId: string

	private readonly log = logger("canvas:chain-solana")

	#store = target.getSessionStore()
	#signer: GenericSigner

	public constructor({ signer, sessionDuration, chainId }: SolanaSignerInit = {}) {
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
	}

	public readonly match = (chain: string) => addressPattern.test(chain)

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

	public async getSession(
		topic: string,
		options: { timestamp?: number; fromCache?: boolean } = {},
	): Promise<Session<SolanaSessionData>> {
		const walletAddress = this.#signer.address
		const address = `${this.chainId}:${walletAddress}`

		this.log("getting session for %s", address)

		{
			const { session, signer } = this.#store.get(topic, address) ?? {}
			if (session !== undefined && signer !== undefined) {
				const { timestamp, duration } = session
				const t = options.timestamp ?? timestamp
				if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
					this.log("found session for %s in store: %o", address, session)
					return session
				} else {
					this.log("stored session for %s has expired", address)
				}
			}
		}

		if (options.fromCache) return Promise.reject()

		this.log("creating new session for %s", address)

		const signer = new Ed25519Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp)

		const message: SolanaMessage = {
			topic,
			publicKey: signer.uri,
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (this.sessionDuration !== null) {
			console.log(issuedAt)
			const expirationTime = new Date(issuedAt.valueOf() + this.sessionDuration)
			console.log(expirationTime)
			message.expirationTime = expirationTime.toISOString()
		}

		const signature = await this.#signer.sign(json.encode(message))

		const session: Session<SolanaSessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			authorizationData: { signature },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		this.#store.set(topic, address, session, signer)

		this.log("created new session for %s: %o", address, session)
		return session
	}

	public sign(message: Message<Action | Session<SolanaSessionData> | Heartbeat>): Signature {
		if (message.payload.type === "heartbeat") {
			const { address, timestamp } = message.payload
			const { signer, session } = this.#store.get(message.topic, address) ?? {}
			assert(signer !== undefined && session !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message)
		} else if (message.payload.type === "action") {
			const { address, timestamp } = message.payload
			const { signer, session } = this.#store.get(message.topic, address) ?? {}
			assert(signer !== undefined && session !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message)
		} else if (message.payload.type === "session") {
			const { signer, session } = this.#store.get(message.topic, message.payload.address) ?? {}
			assert(signer !== undefined && session !== undefined)

			// only sign our own current sessions
			assert(message.payload === session)
			return signer.sign(message)
		} else {
			signalInvalidType(message.payload)
		}
	}

	public async clear(topic: string) {
		this.#store.clear(topic)
	}
}
