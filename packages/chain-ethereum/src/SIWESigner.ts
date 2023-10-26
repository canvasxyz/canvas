import { AbstractSigner, Wallet, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import type { SessionSigner, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"
import { Signature, createSignature } from "@canvas-js/signed-cid"
import { secp256k1 } from "@noble/curves/secp256k1"

import { getDomain } from "@canvas-js/chain-ethereum/domain"

import type { SIWESessionData, SIWEMessage } from "./types.js"
import {
	assert,
	signalInvalidType,
	SIWEMessageVersion,
	validateSessionData,
	parseChainId,
	chainPattern,
	prepareSIWEMessage,
	getSessionURI,
	getKey,
} from "./utils.js"

export interface SIWESignerInit {
	signer?: AbstractSigner
	store?: SessionStore
	sessionDuration?: number
}

export class SIWESigner implements SessionSigner {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-ethereum")

	#signer: AbstractSigner
	#store: SessionStore | null
	#privateKeys: Record<string, Uint8Array> = {}
	#sessions: Record<string, Session<SIWESessionData>> = {}
	// #chains: Record<string, { privateKey: Uint8Array; session: Session<SIWESessionData> }> = {}

	public constructor(init: SIWESignerInit = {}) {
		this.#signer = init.signer ?? Wallet.createRandom()
		this.#store = init.store ?? null
		this.sessionDuration = init.sessionDuration ?? null
	}

	public readonly match = (chain: string) => chainPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKeyType, publicKey, chain, address, data, timestamp, duration } = session
		assert(publicKeyType === "secp256k1", "SIWE sessions must use secp256k1 keys")

		assert(validateSessionData(data), "invalid session")

		const siweMessage = prepareSIWEMessage({
			version: SIWEMessageVersion,
			domain: data.domain,
			nonce: data.nonce,
			address: address,
			uri: getSessionURI(chain, publicKey),
			chainId: parseChainId(chain),
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		})

		const recoveredAddress = verifyMessage(siweMessage, hexlify(data.signature))
		if (recoveredAddress !== address) {
			throw new Error("invalid SIWE signature")
		}
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<SIWESessionData>> {
		const chain = options.chain ?? `eip155:1`
		assert(chainPattern.test(chain), "internal error - invalid chain")

		const address = await this.#signer.getAddress()
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
				const { privateKey, session } = json.parse<{ privateKey: Uint8Array; session: Session<SIWESessionData> }>(
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

		const domain = getDomain()
		const nonce = siwe.generateNonce()

		const privateKey = secp256k1.utils.randomPrivateKey()
		const publicKey = secp256k1.getPublicKey(privateKey)

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const message: SIWEMessage = {
			version: SIWEMessageVersion,
			address: address,
			chainId: parseChainId(chain),
			domain: domain,
			uri: getSessionURI(chain, publicKey),
			nonce: nonce,
			issuedAt: issuedAt,
			expirationTime: null,
		}

		if (this.sessionDuration !== null) {
			message.expirationTime = new Date(timestamp + this.sessionDuration).toISOString()
		}

		const signature = await this.#signer.signMessage(prepareSIWEMessage(message))

		const session: Session<SIWESessionData> = {
			type: "session",
			chain: chain,
			address: address,
			publicKeyType: "secp256k1",
			publicKey: secp256k1.getPublicKey(privateKey),
			data: { signature: getBytes(signature), domain, nonce },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		this.#sessions[key] = session
		this.#privateKeys[key] = privateKey
		if (this.#store !== null) {
			await this.#store.set(key, json.stringify({ privateKey, session }))
		}

		this.log("created new session for %s: %o", key, session)
		return session
	}

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

			return createSignature("secp256k1", privateKey, { topic, clock, parents, payload } satisfies Message<Action>)
		} else if (payload.type === "session") {
			const { chain, address } = payload
			const key = getKey(topic, chain, address)
			const session = this.#sessions[key]
			const privateKey = this.#privateKeys[key]
			assert(session !== undefined && privateKey !== undefined)

			// only sign our own current sessions
			assert(payload === session)

			return createSignature("secp256k1", privateKey, { topic, clock, parents, payload } satisfies Message<Session>)
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
