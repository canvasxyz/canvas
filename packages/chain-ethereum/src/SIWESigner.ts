import { AbstractSigner, Wallet, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import type { Signature, Signer, SessionSigner, Action, SessionStore, Message, Session } from "@canvas-js/interfaces"
import { Secp256k1Signer, didKeyPattern } from "@canvas-js/signed-cid"

import { getDomain } from "@canvas-js/chain-ethereum/domain"

import type { SIWESessionData, SIWEMessage } from "./types.js"
import {
	assert,
	signalInvalidType,
	SIWEMessageVersion,
	validateSessionData,
	parseAddress,
	addressPattern,
	prepareSIWEMessage,
	getKey,
} from "./utils.js"

export interface SIWESignerInit {
	signer?: AbstractSigner
	store?: SessionStore
	sessionDuration?: number
}

export class SIWESigner implements SessionSigner<SIWESessionData> {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-ethereum")

	#ethersSigner: AbstractSigner
	#store: SessionStore | null
	#signers: Record<string, Signer<Message<Action | Session>>> = {}
	#sessions: Record<string, Session<SIWESessionData>> = {}

	public constructor(init: SIWESignerInit = {}) {
		this.#ethersSigner = init.signer ?? Wallet.createRandom()
		this.#store = init.store ?? null
		this.sessionDuration = init.sessionDuration ?? null
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public verifySession(session: Session<SIWESessionData>) {
		const { publicKey, address, data, timestamp, duration } = session

		assert(didKeyPattern.test(publicKey), "invalid signing key")
		assert(validateSessionData(data), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			domain: data.domain,
			nonce: data.nonce,
			chainId: chainId,
			address: walletAddress,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		const recoveredAddress = verifyMessage(prepareSIWEMessage(siweMessage), hexlify(data.signature))
		assert(recoveredAddress === walletAddress, "invalid SIWE signature")
	}

	public async getSession(topic: string, options: { timestamp?: number } = {}): Promise<Session<SIWESessionData>> {
		const walletAddress = await this.#ethersSigner.getAddress()
		const network = await this.#ethersSigner.provider?.getNetwork()
		const chainId = network?.chainId?.toString() ?? "1"

		const address = `eip155:${chainId}:${walletAddress}`
		const key = getKey(topic, address)

		this.log("getting session %s", key)

		// First check the in-memory cache

		if (this.#sessions[key] !== undefined) {
			const session = this.#sessions[key]
			const { timestamp, duration } = session
			const t = options.timestamp ?? timestamp
			if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
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
					type: "secp256k1"
					privateKey: Uint8Array
					session: Session<SIWESessionData>
				}>(privateSessionData)
				assert(type === "secp256k1", "unexpected signature type")

				const { timestamp, duration } = session
				const t = options.timestamp ?? timestamp
				if (timestamp <= t && t <= timestamp + (duration ?? Infinity)) {
					this.#signers[key] = new Secp256k1Signer(privateKey)
					this.#sessions[key] = session
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

		const signer = new Secp256k1Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			address: walletAddress,
			chainId: parseInt(chainId),
			domain: domain,
			uri: signer.uri,
			nonce: nonce,
			issuedAt: issuedAt,
			expirationTime: null,
		}

		if (this.sessionDuration !== null) {
			siweMessage.expirationTime = new Date(timestamp + this.sessionDuration).toISOString()
		}

		const signature = await this.#ethersSigner.signMessage(prepareSIWEMessage(siweMessage))

		const session: Session<SIWESessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			data: { signature: getBytes(signature), domain, nonce },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		this.#sessions[key] = session
		this.#signers[key] = signer
		if (this.#store !== null) {
			const { type, privateKey } = signer.export()
			await this.#store.set(key, json.stringify({ type, privateKey, session }))
		}

		this.log("created new session for %s: %o", key, session)
		return session
	}

	public sign(message: Message<Action | Session>): Signature {
		const { payload } = message
		if (payload.type === "action") {
			const { address, timestamp } = payload
			const key = getKey(message.topic, address)
			const signer = this.#signers[key]
			const session = this.#sessions[key]
			assert(signer !== undefined && session !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message)
		} else if (payload.type === "session") {
			const key = getKey(message.topic, payload.address)
			const session = this.#sessions[key]
			const signer = this.#signers[key]
			assert(signer !== undefined && session !== undefined)

			// only sign our own current sessions
			assert(payload === session)
			return signer.sign(message)
		} else {
			signalInvalidType(payload)
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
