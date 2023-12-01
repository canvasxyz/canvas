import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"
import { KeyPair } from "near-api-js"
import { PublicKey } from "@near-js/crypto"
import { ed25519 } from "@noble/curves/ed25519"

import type { Signature, Signer, SessionSigner, Action, Message, Session, Heartbeat } from "@canvas-js/interfaces"
import { Ed25519Signer } from "@canvas-js/signed-cid"

import { NEARMessage, NEARSessionData } from "./types.js"
import { assert, signalInvalidType, validateSessionData, addressPattern, getKey, parseAddress } from "./utils.js"

import target from "#target"

export interface NEARSignerInit {
	chainId?: string
	keyPair?: KeyPair
	sessionDuration?: number
}

export class NEARSigner implements SessionSigner<NEARSessionData> {
	public readonly sessionDuration: number | null
	public readonly chainId: string

	private readonly log = logger("canvas:chain-near")

	#address: string
	#keyPair: KeyPair
	#store = target.getSessionStore()

	public constructor({ keyPair, sessionDuration, chainId }: NEARSignerInit = {}) {
		this.#keyPair = keyPair ?? KeyPair.fromRandom("ed25519")
		this.#address = this.#keyPair.getPublicKey().toString().split(":")[1]

		this.chainId = chainId ?? "near:mainnet"
		this.sessionDuration = sessionDuration ?? null
	}

	public readonly match = (chain: string) => addressPattern.test(chain)

	public verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session
		assert(validateSessionData(data), "invalid session")
		const [chain, walletAddress] = parseAddress(address)

		const walletAddressFromPublicKey = new PublicKey({ keyType: 0, data: data.publicKey }).toString().split(":")[1]
		assert(walletAddress == walletAddressFromPublicKey, "the wallet address does not match the public key")

		const message: NEARMessage = {
			topic,
			publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const valid = ed25519.verify(data.signature, cbor.encode(message), data.publicKey)
		assert(valid, "invalid signature")
	}

	public async getSession(
		topic: string,
		options: { timestamp?: number; fromCache?: boolean } = {},
	): Promise<Session<NEARSessionData>> {
		const walletAddress = this.#address
		const address = `${this.chainId}:${walletAddress}`

		this.log("getting session for %s", address)

		// First check the in-memory cache
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

		const message: NEARMessage = {
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

		const { signature, publicKey } = this.#keyPair.sign(cbor.encode(message))

		const session: Session<NEARSessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			authorizationData: {
				signature,
				publicKey: publicKey.data,
			},
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		this.#store.set(topic, address, session, signer)

		this.log("created new session for %s: %o", address, session)
		return session
	}

	public sign(message: Message<Action | Session<NEARSessionData> | Heartbeat>): Signature {
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
