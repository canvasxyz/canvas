import * as json from "@ipld/dag-json"
import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"
import { KeyPair } from "near-api-js"
import { PublicKey } from "@near-js/crypto"
import { ed25519 } from "@noble/curves/ed25519"

import type { Signature, Signer, SessionSigner, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"

import { NEARMessage, NEARSessionData } from "./types.js"
import { assert, signalInvalidType, validateSessionData, addressPattern, getKey, parseAddress } from "./utils.js"

export interface NEARSignerInit {
	chainId?: string
	keyPair?: KeyPair
	store?: SessionStore
	sessionDuration?: number
}

export class NEARSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	public readonly chainId: string

	private readonly log = logger("canvas:chain-near")

	#address: string
	#keyPair: KeyPair
	#store: SessionStore | null
	#signers: Record<string, Signer<Message<Action | Session>>> = {}
	#sessions: Record<string, Session<NEARSessionData>> = {}

	public constructor({ keyPair, store, sessionDuration, chainId }: NEARSignerInit = {}) {
		this.#keyPair = keyPair ?? KeyPair.fromRandom("ed25519")
		this.#address = this.#keyPair.getPublicKey().toString().split(":")[1]

		this.chainId = chainId ?? "near:mainnet"
		this.sessionDuration = sessionDuration ?? null
		this.#store = store ?? null
	}

	public readonly match = (chain: string) => addressPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKey, address, data, timestamp, duration } = session
		assert(validateSessionData(data), "invalid session")
		const [chain, walletAddress] = parseAddress(address)

		const walletAddressFromPublicKey = new PublicKey({ keyType: 0, data: data.publicKey }).toString().split(":")[1]
		assert(walletAddress == walletAddressFromPublicKey, "the wallet address does not match the public key")

		const message: NEARMessage = {
			publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const valid = ed25519.verify(data.signature, cbor.encode(message), data.publicKey)
		assert(valid, "invalid signature")
	}

	public async getSession(topic: string, options: { timestamp?: number } = {}): Promise<Session<NEARSessionData>> {
		const walletAddress = this.#address
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
					session: Session<NEARSessionData>
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

		const message: NEARMessage = {
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

		const { signature, publicKey } = this.#keyPair.sign(cbor.encode(message))

		const session: Session<NEARSessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			data: {
				signature,
				publicKey: publicKey.data,
			},
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
