import { AbstractSigner, Wallet, computeAddress, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import type { Signer, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"
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
} from "./utils.js"

export interface SIWESignerInit {
	signer?: AbstractSigner
	store?: SessionStore
	sessionDuration?: number
}

export class SIWESigner implements Signer {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-ethereum")

	#signer: AbstractSigner
	#store: SessionStore | null
	#chains: Record<string, { privateKey: Uint8Array; session: Session<SIWESessionData> }> = {}

	public constructor(init: SIWESignerInit = {}) {
		this.#signer = init.signer ?? Wallet.createRandom()
		this.#store = init.store ?? null
		this.sessionDuration = init.sessionDuration ?? null
	}

	public readonly match = (chain: string) => chainPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKeyType, publicKey, chain, address, data, timestamp, duration } = session
		assert(publicKeyType === "secp256k1", "SIWE sessions must use secp256k1 keys")

		const chainId = parseChainId(chain)
		assert(validateSessionData(data), "invalid session")

		const sessionAddress = computeAddress(hexlify(publicKey))

		const uri = getSessionURI(chainId, sessionAddress)
		const siweMessage = prepareSIWEMessage({
			version: SIWEMessageVersion,
			domain: data.domain,
			nonce: data.nonce,
			address: address,
			uri: uri,
			chainId: chainId,
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

		const id = `${topic}/${chain}`

		this.log("getting session %s", id)

		// First check the in-memory cache
		if (this.#chains[id] !== undefined) {
			const { session } = this.#chains[id]
			if (options.timestamp === undefined) {
				this.log("found session %s in cache: %o", id, session)
				return session
			} else if (
				options.timestamp >= session.timestamp &&
				options.timestamp <= session.timestamp + (session.duration ?? Infinity)
			) {
				this.log("found session %s in cache: %o", id, session)
				return session
			} else {
				this.log("cached session %s has expired", id)
			}
		}

		// Then check the persistent store
		if (this.#store !== null) {
			const privateSessionData = await this.#store.load(topic, chain, address)
			if (privateSessionData !== null) {
				const { privateKey, session } = json.parse<{ privateKey: Uint8Array; session: Session<SIWESessionData> }>(
					privateSessionData
				)

				if (options.timestamp === undefined) {
					this.#chains[id] = { privateKey, session }
					this.log("found session %s in store: %o", id, session)
					return session
				} else if (
					options.timestamp >= session.timestamp &&
					options.timestamp <= session.timestamp + (session.duration ?? Infinity)
				) {
					this.#chains[id] = { privateKey, session }
					this.log("found session %s in store: %o", id, session)
					return session
				} else {
					this.log("stored session %s has expired", id)
				}
			}
		}

		this.log("creating new session for %s", id)

		const chainId = parseChainId(chain)

		const domain = getDomain()
		const nonce = siwe.generateNonce()

		const privateKey = secp256k1.utils.randomPrivateKey()
		const sessionAddress = computeAddress(hexlify(privateKey))

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const message: SIWEMessage = {
			version: SIWEMessageVersion,
			address: address,
			chainId: chainId,
			domain: domain,
			uri: getSessionURI(chainId, sessionAddress),
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
			topic: topic,
			publicKeyType: "secp256k1",
			publicKey: secp256k1.getPublicKey(privateKey),
			data: { signature: getBytes(signature), domain, nonce },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		this.#chains[id] = { privateKey, session }
		if (this.#store !== null) {
			await this.#store.save(topic, chain, session.address, json.stringify({ privateKey, session }))
		}

		this.log("created new session for %s: %o", id, session)
		return session
	}

	public sign({ clock, parents, payload }: Message<Action | Session>): Signature {
		if (payload.type === "action") {
			const id = `${payload.topic}/${payload.chain}`
			assert(this.#chains[id] !== undefined)
			const { privateKey, session } = this.#chains[id]

			assert(payload.address === session.address)
			assert(payload.timestamp >= session.timestamp)
			assert(payload.timestamp <= session.timestamp + (session.duration ?? Infinity))

			return createSignature("secp256k1", privateKey, { clock, parents, payload } satisfies Message<Action>)
		} else if (payload.type === "session") {
			const id = `${payload.topic}/${payload.chain}`
			assert(this.#chains[id] !== undefined)
			const { privateKey, session } = this.#chains[id]

			// only sign our own, current sessions
			// assert(CID.equals(getCID(payload), getCID(session)))
			assert(payload === session)

			return createSignature("secp256k1", privateKey, { clock, parents, payload } satisfies Message<Session>)
		} else {
			signalInvalidType(payload)
		}
	}
}
