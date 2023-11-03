import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"
import * as json from "@ipld/dag-json"
import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"
import { ed25519 } from "@noble/curves/ed25519"

import type {
	Signature,
	SessionSigner,
	Action,
	SessionStore,
	Message,
	Session,
	SignatureType,
} from "@canvas-js/interfaces"
import { createSignature, getPublicKeyURI } from "@canvas-js/signed-cid"

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
	public readonly publicKeyType: SignatureType = "ed25519"

	private readonly log = logger("canvas:chain-solana")

	#signer: GenericSigner
	#store: SessionStore | null
	#privateKeys: Record<string, Uint8Array> = {}
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
			const keypair = solw3.Keypair.generate()
			this.#signer = {
				address: base58btc.baseEncode(keypair.publicKey.toBytes()),
				sign: async (msg) => ed25519.sign(msg, keypair.secretKey.subarray(0, 32)),
			}
		}

		// 5ey... is the solana mainnet genesis hash
		this.chainId = chainId ?? "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
		this.sessionDuration = sessionDuration ?? null
		this.#store = store ?? null
	}

	public readonly match = (chain: string) => addressPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKeyType, publicKey, address, data, timestamp, duration } = session
		assert(publicKeyType === this.publicKeyType, `Solana sessions must use ${this.publicKeyType} keys`)

		assert(validateSessionData(data), "invalid session")

		const [_, walletAddress] = parseAddress(address)

		const message: SolanaMessage = {
			address: address,
			signingKey: getPublicKeyURI(this.publicKeyType, publicKey),
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		assert(
			ed25519.verify(data.signature, cbor.encode(message), base58btc.baseDecode(walletAddress)),
			"invalid signature"
		)
	}

	public async getSession(topic: string, options: { timestamp?: number } = {}): Promise<Session<SolanaSessionData>> {
		const walletAddress = this.#signer.address
		const address = `${this.chainId}:${walletAddress}`
		const key = getKey(topic, address)

		this.log("getting session %s", key)

		// First check the in-memory cache

		if (this.#sessions[key] !== undefined) {
			const session = this.#sessions[key]
			if (options.timestamp === undefined) {
				this.log("found session %s in cache: %o", key, session)
				return session
			} else if (
				options.timestamp >= session.timestamp &&
				options.timestamp <= session.timestamp + (session.duration ?? Infinity)
			) {
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
				const { privateKey, session } = json.parse<{ privateKey: Uint8Array; session: Session<SolanaSessionData> }>(
					privateSessionData
				)

				if (options.timestamp === undefined) {
					this.#sessions[key] = session
					this.#privateKeys[key] = privateKey
					this.log("found session %s in store: %o", key, session)
					return session
				} else if (
					options.timestamp >= session.timestamp &&
					options.timestamp <= session.timestamp + (session.duration ?? Infinity)
				) {
					this.#sessions[key] = session
					this.#privateKeys[key] = privateKey
					this.log("found session %s in store: %o", key, session)
					return session
				} else {
					this.log("stored session %s has expired", key)
				}
			}
		}

		this.log("creating new session for %s", key)

		const privateKey = ed25519.utils.randomPrivateKey()
		const publicKey = ed25519.getPublicKey(privateKey)

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp)

		const message: SolanaMessage = {
			address: address,
			signingKey: getPublicKeyURI(this.publicKeyType, publicKey),
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
			publicKeyType: this.publicKeyType,
			publicKey,
			data: { signature },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		// save the session and private key in the cache and the store
		this.#sessions[key] = session
		this.#privateKeys[key] = privateKey
		if (this.#store !== null) {
			await this.#store.set(key, json.stringify({ privateKey, session }))
		}

		this.log("created new session for %s: %o", key, session)
		return session
	}

	// i think this method might be totally generic, maybe we could factor it out
	public sign(message: Message<Action | Session>): Signature {
		const { topic, clock, parents, payload } = message
		if (payload.type === "action") {
			const { address, timestamp } = payload
			const key = getKey(topic, address)
			const session = this.#sessions[key]
			const privateKey = this.#privateKeys[key]
			assert(session !== undefined && privateKey !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return createSignature(this.publicKeyType, privateKey, message)
		} else if (payload.type === "session") {
			const { address } = payload
			const key = getKey(topic, address)
			const session = this.#sessions[key]
			const privateKey = this.#privateKeys[key]
			assert(session !== undefined && privateKey !== undefined)

			// only sign our own current sessions
			assert(payload === session)

			return createSignature(this.publicKeyType, privateKey, message)
		} else {
			signalInvalidType(payload)
		}
	}

	public async clear() {
		for (const key of Object.keys(this.#sessions)) {
			await this.#store?.delete(key)
			delete this.#sessions[key]
			delete this.#privateKeys[key]
		}
	}
}
