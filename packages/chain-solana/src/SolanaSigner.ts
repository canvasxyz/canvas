import solw3 from "@solana/web3.js"
import { base58btc } from "multiformats/bases/base58"
import { encode } from "microcbor"
import nacl from "tweetnacl"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import type {
	Signature,
	SessionSigner,
	Action,
	SessionStore,
	Message,
	Session,
	SignatureType,
} from "@canvas-js/interfaces"
import { createSignature } from "@canvas-js/signed-cid"

import { ed25519 } from "@noble/curves/ed25519"

import {
	assert,
	signalInvalidType,
	validateSessionData,
	parseChainId,
	chainPattern,
	getSessionURI,
	getKey,
} from "./utils.js"
import { SolanaMessage, SolanaSessionData } from "./types.js"

// Solana doesn't publish TypeScript signatures for injected wallets, but we can assume
// most wallets expose a Phantom-like API and use their injected `window.solana` objects directly:
// https://github.com/solana-labs/wallet-adapter/commit/5a274e0a32c55d4376d63a802f0d512947b087af
interface SolanaWindowSigner {
	publicKey?: solw3.PublicKey
	signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

export interface SolanaSignerInit {
	signer?: SolanaWindowSigner
	store?: SessionStore
	sessionDuration?: number
}

type GenericSigner = {
	address: string
	sign: (msg: Uint8Array) => Promise<Uint8Array>
}

const SIGNATURE_TYPE: SignatureType = "ed25519"

export class SolanaSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	// TODO: give the logger a name
	private readonly log = logger("canvas:chain-CHAIN NAME")

	#signer: GenericSigner
	#store: SessionStore | null
	#privateKeys: Record<string, Uint8Array> = {}
	#sessions: Record<string, Session<SolanaSessionData>> = {}

	public constructor({ signer, store, sessionDuration }: SolanaSignerInit = {}) {
		if (signer) {
			if (!signer.publicKey) throw new Error("Invalid signer")
			this.#signer = {
				address: base58btc.baseEncode(signer.publicKey.toBytes()),
				sign: async (msg) => (await signer.signMessage(msg)).signature,
			}
		} else {
			const keypair = solw3.Keypair.generate()
			this.#signer = {
				address: base58btc.baseEncode(keypair.publicKey.toBytes()),
				sign: async (msg) => nacl.sign.detached(msg, keypair.secretKey),
			}
		}

		this.#store = store ?? null
		this.sessionDuration = sessionDuration ?? null
	}

	public readonly match = (chain: string) => chainPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKeyType, publicKey, chain, address, data, timestamp, duration } = session
		assert(publicKeyType === SIGNATURE_TYPE, `Solana sessions must use ${SIGNATURE_TYPE} keys`)

		assert(validateSessionData(data), "invalid session")

		const chainId = parseChainId(chain)

		const message: SolanaMessage = {
			address,
			chainId,
			uri: getSessionURI(chainId, publicKey),
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const valid = nacl.sign.detached.verify(encode(message), data.signature, base58btc.baseDecode(address))
		assert(valid, "invalid signature")
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<SolanaSessionData>> {
		const chain = options.chain ?? "solana:mainnet"
		assert(chainPattern.test(chain), "internal error - invalid chain")

		const address = this.#signer.address
		const key = getKey(topic, chain, address)

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
				// TODO: parse the private session data
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

		const chainId = parseChainId(chain)
		const message: SolanaMessage = {
			address,
			chainId,
			uri: getSessionURI(chainId, publicKey),
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (this.sessionDuration !== null) {
			console.log(issuedAt)
			const expirationTime = new Date(issuedAt.valueOf() + this.sessionDuration)
			console.log(expirationTime)
			message.expirationTime = expirationTime.toISOString()
		}

		const signature = await this.#signer.sign(encode(message))

		const session: Session<SolanaSessionData> = {
			type: "session",
			chain: chain,
			address: address,
			publicKeyType: SIGNATURE_TYPE,
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
	public sign({ topic, clock, parents, payload }: Message<Action | Session>): Signature {
		if (payload.type === "action") {
			const { chain, address, timestamp } = payload
			const key = getKey(topic, chain, address)
			const session = this.#sessions[key]
			const privateKey = this.#privateKeys[key]
			assert(session !== undefined && privateKey !== undefined)

			assert(chain === session.chain && address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			// TODO: the signature type should correspond to the one we are validating
			return createSignature(SIGNATURE_TYPE, privateKey, { topic, clock, parents, payload } satisfies Message<Action>)
		} else if (payload.type === "session") {
			const { chain, address } = payload
			const key = getKey(topic, chain, address)
			const session = this.#sessions[key]
			const privateKey = this.#privateKeys[key]
			assert(session !== undefined && privateKey !== undefined)

			// only sign our own current sessions
			assert(payload === session)

			// TODO: the signature type should correspond to the one we are validating
			return createSignature(SIGNATURE_TYPE, privateKey, { topic, clock, parents, payload } satisfies Message<Session>)
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
