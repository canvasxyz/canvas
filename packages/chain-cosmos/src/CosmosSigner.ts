import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import type { Signature, SessionSigner, Action, SessionStore, Message, Session, Signer } from "@canvas-js/interfaces"
import { Secp256k1Signer, didKeyPattern } from "@canvas-js/signed-cid"

import { assert, signalInvalidType, validateSessionData, getKey, addressPattern, parseAddress } from "./utils.js"
import { CosmosMessage, CosmosSessionData, ExternalCosmosSigner } from "./types.js"
import { createDefaultSigner } from "./external_signers/default.js"
import { createEthereumSigner, verifyEthereum } from "./external_signers/ethereum.js"
import { createAminoSigner, verifyAmino } from "./external_signers/amino.js"
import { createBytesSigner, verifyBytes } from "./external_signers/bytes.js"

export interface CosmosSignerInit {
	signer?: ExternalCosmosSigner
	store?: SessionStore
	sessionDuration?: number
	bech32Prefix?: string
}

type GenericSigner = {
	getChainId: () => Promise<string>
	getAddress: (chainId: string) => Promise<string>
	sign: (msg: CosmosMessage, signerAddress: string, chainId: string) => Promise<CosmosSessionData>
}

export class CosmosSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-cosmos")

	#signer: GenericSigner
	#store: SessionStore | null
	#signers: Record<string, Signer<Message<Action | Session>>> = {}
	#sessions: Record<string, Session<CosmosSessionData>> = {}

	public constructor({ signer, store, sessionDuration, bech32Prefix }: CosmosSignerInit = {}) {
		const bech32Prefix_ = bech32Prefix == undefined ? "cosmos" : bech32Prefix

		if (signer == undefined) {
			this.#signer = createDefaultSigner(bech32Prefix_)
		} else if (signer.type == "ethereum") {
			this.#signer = createEthereumSigner(signer, bech32Prefix_)
		} else if (signer.type == "amino") {
			this.#signer = createAminoSigner(signer)
		} else if (signer.type == "bytes") {
			this.#signer = createBytesSigner(signer)
		} else {
			throw new Error("invalid signer")
		}

		this.#store = store ?? null
		this.sessionDuration = sessionDuration ?? null
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public async verifySession(session: Session) {
		const { publicKey, address, data, timestamp, duration } = session

		assert(didKeyPattern.test(publicKey), "invalid signing key")
		assert(validateSessionData(data), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const message: CosmosMessage = {
			address: walletAddress,
			chainId,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		// select verification method based on the signing method
		if (data.signatureType == "ethereum") {
			verifyEthereum(message, data)
		} else if (data.signatureType == "amino") {
			await verifyAmino(message, data)
		} else if (data.signatureType == "bytes") {
			verifyBytes(message, data)
		} else {
			signalInvalidType(data.signatureType)
		}
	}

	public async getSession(topic: string, options: { timestamp?: number } = {}): Promise<Session<CosmosSessionData>> {
		const chainId = await this.#signer.getChainId()
		const walletAddress = await this.#signer.getAddress(chainId)
		const address = `cosmos:${chainId}:${walletAddress}`
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
				const { type, privateKey, session } = json.parse<{
					type: "secp256k1"
					privateKey: Uint8Array
					session: Session<CosmosSessionData>
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

		const signer = new Secp256k1Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp)
		const message: CosmosMessage = {
			address: walletAddress,
			chainId,
			uri: signer.uri,
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}
		if (this.sessionDuration !== null) {
			message.expirationTime = new Date(timestamp + this.sessionDuration).toISOString()
		}

		const signResult = await this.#signer.sign(message, walletAddress, chainId)

		const session: Session<CosmosSessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			data: signResult,
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
		const { payload } = message
		if (payload.type === "action") {
			const { address, timestamp } = payload
			const key = getKey(message.topic, address)
			const session = this.#sessions[key]
			const signer = this.#signers[key]
			assert(signer !== undefined && session !== undefined)

			assert(address === session.address)
			assert(timestamp >= session.timestamp)
			assert(timestamp <= session.timestamp + (session.duration ?? Infinity))

			return signer.sign(message)
		} else if (payload.type === "session") {
			const { address } = payload
			const key = getKey(message.topic, address)
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
