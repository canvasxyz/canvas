import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"

import type { Signature, SessionSigner, Action, Message, Session, Heartbeat } from "@canvas-js/interfaces"
import { Secp256k1Signer, didKeyPattern } from "@canvas-js/signed-cid"

import { assert, signalInvalidType, validateSessionData, addressPattern, parseAddress } from "./utils.js"
import { CosmosMessage, CosmosSessionData, ExternalCosmosSigner } from "./types.js"
import { createDefaultSigner } from "./external_signers/default.js"
import { createEthereumSigner, verifyEthereum } from "./external_signers/ethereum.js"
import { createAminoSigner, verifyAmino } from "./external_signers/amino.js"
import { createBytesSigner, verifyBytes } from "./external_signers/bytes.js"

import target from "#target"

export interface CosmosSignerInit {
	signer?: ExternalCosmosSigner
	sessionDuration?: number
	bech32Prefix?: string
}

type GenericSigner = {
	getChainId: () => Promise<string>
	getAddress: (chainId: string) => Promise<string>
	sign: (msg: CosmosMessage, signerAddress: string, chainId: string) => Promise<CosmosSessionData>
}

export class CosmosSigner implements SessionSigner<CosmosSessionData> {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-cosmos")

	#signer: GenericSigner
	#store = target.getSessionStore()

	public constructor({ signer, sessionDuration, bech32Prefix }: CosmosSignerInit = {}) {
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

		this.sessionDuration = sessionDuration ?? null
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public async verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session

		assert(didKeyPattern.test(publicKey), "invalid signing key")
		assert(validateSessionData(data), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const message: CosmosMessage = {
			topic: topic,
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

	public async getSession(
		topic: string,
		options: { timestamp?: number; fromCache?: boolean } = {},
	): Promise<Session<CosmosSessionData>> {
		const chainId = await this.#signer.getChainId()
		const walletAddress = await this.#signer.getAddress(chainId)
		const address = `cosmos:${chainId}:${walletAddress}`

		this.log("getting session for %s", address)

		{
			const { signer, session } = (await this.#store.get(topic, address)) ?? {}
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

		const signer = new Secp256k1Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp)
		const message: CosmosMessage = {
			topic: topic,
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
			authorizationData: signResult,
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		// save the session and private key in the cache and the store
		this.#store.set(topic, address, session, signer)

		this.log("created new session for %s: %o", address, session)
		return session
	}

	public sign(message: Message<Action | Session<CosmosSessionData> | Heartbeat>): Signature {
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
