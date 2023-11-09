import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"
import * as json from "@ipld/dag-json"
import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"

import { ed25519 } from "@noble/curves/ed25519"

import type { Signature, Signer, SessionSigner, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"

import { assert, signalInvalidType, validateSessionData, addressPattern, getKey, parseAddress } from "./utils.js"
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
	store?: SessionStore
	sessionDuration?: number
}

type GenericSigner = {
	address: string
	sign: (msg: Uint8Array) => Promise<Uint8Array>
}

export class SolanaSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	public readonly chainId: string

	private readonly log = logger("canvas:chain-solana")

	#signer: GenericSigner
	#store: SessionStore | null
	#signers: Record<string, Signer<Message<Action | Session>>> = {}
	#sessions: Record<string, Session<SolanaSessionData>> = {}

	public constructor({ signer, store, sessionDuration, chainId }: SolanaSignerInit = {}) {
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
		this.#store = store ?? null
	}

	public readonly match = (chain: string) => addressPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session
		assert(validateSessionData(data), "invalid session")

		const [_, walletAddress] = parseAddress(address)

		const message: SolanaMessage = {
			publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const signingPublicKey = base58btc.baseDecode(walletAddress)

		const valid = ed25519.verify(data.signature, cbor.encode(message), signingPublicKey)
		// get the address who signed this, this is solana specific?
		assert(valid, "invalid signature")
	}

	public async getSession(topic: string, options: { timestamp?: number } = {}): Promise<Session<SolanaSessionData>> {
		const walletAddress = this.#signer.address
		const address = `${this.chainId}:${walletAddress}`
		const key = getKey(topic, address)

		this.log("getting session %s", key)

		// First check the in-memory cache

		if (this.#sessions[key] !== undefined) {
			const session = this.#sessions[key]
			const { timestamp, duration } = session
			const t = options.timestamp ?? timestamp
			if (t >= timestamp && t <= timestamp + (duration ?? Infinity)) {
				this.log("found session %s in cache: %o", key, session)
				return session
			} else {
				this.log("cached session %s has expired", key)
			}
		}

		// Then check the persistent store
		if (this.#store !== null) {
			const privateSessionData = await this.#store.get(key)
			if (privateSessionData !== null) {
				const { type, privateKey, session } = json.parse<{
					type: "ed25519"
					privateKey: Uint8Array
					session: Session<SolanaSessionData>
				}>(privateSessionData)

				assert(type === "ed25519", "invalid signature type")

				const { timestamp, duration } = session
				const t = options.timestamp ?? timestamp
				if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
					this.#sessions[key] = session
					this.#signers[key] = new Ed25519Signer(privateKey)
					this.log("found session %s in store: %o", key, session)
					return session
				} else {
					this.log("stored session %s has expired", key)
				}
			}
		}

		this.log("creating new session for %s", key)

		const signer = new Ed25519Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp)

		const message: SolanaMessage = {
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

		const signature = await this.#signer.sign(cbor.encode(message))

		const session: Session<SolanaSessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			authorizationData: { signature },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		// save the session and private key in the cache and the store
		this.#sessions[key] = session
		this.#signers[key] = signer
		if (this.#store !== null) {
			const { type, privateKey } = signer.export()
			await this.#store.set(key, json.stringify({ type, privateKey, session }))
		}

		this.log("created new session for %s: %o", key, session)
		return session
	}

	// i think this method might be totally generic, maybe we could factor it out
	public sign(message: Message<Action | Session>): Signature {
		if (message.payload.type === "action") {
			const { address, timestamp } = message.payload
			const key = getKey(message.topic, address)
			const session = this.#sessions[key]
			const signer = this.#signers[key]
			assert(session !== undefined && signer !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message)
		} else if (message.payload.type === "session") {
			const key = getKey(message.topic, message.payload.address)
			const session = this.#sessions[key]
			const signer = this.#signers[key]
			assert(session !== undefined && signer !== undefined)

			// only sign our own current sessions
			assert(message.payload === session)

			return signer.sign(message)
		} else {
			signalInvalidType(message.payload)
		}
	}

	public async clear() {
		for (const key of Object.keys(this.#sessions)) {
			await this.#store?.delete(key)
			delete this.#sessions[key]
			delete this.#signers[key]
		}
	}
}
