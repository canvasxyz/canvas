import { AbstractSigner, Wallet, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"
import { logger } from "@libp2p/logger"

import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces"
import { Secp256k1Signer, didKeyPattern } from "@canvas-js/signed-cid"

import target from "#target"

import type { SIWESessionData, SIWEMessage } from "./types.js"
import {
	assert,
	signalInvalidType,
	SIWEMessageVersion,
	validateSessionData,
	parseAddress,
	addressPattern,
	prepareSIWEMessage,
} from "./utils.js"

export interface SIWESignerInit {
	chainId?: number
	signer?: AbstractSigner
	sessionDuration?: number
}

export class SIWESigner implements SessionSigner<SIWESessionData> {
	public readonly sessionDuration: number | null
	public readonly chainId: number

	private readonly log = logger("canvas:chain-ethereum")

	#store = target.getSessionStore()
	#ethersSigner: AbstractSigner

	public constructor(init: SIWESignerInit = {}) {
		this.#ethersSigner = init.signer ?? Wallet.createRandom()
		this.sessionDuration = init.sessionDuration ?? null
		this.chainId = init.chainId ?? 1
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public verifySession(topic: string, session: Session<SIWESessionData>) {
		const { publicKey, address, authorizationData, timestamp, duration } = session

		assert(didKeyPattern.test(publicKey), "invalid signing key")
		assert(validateSessionData(authorizationData), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			domain: authorizationData.domain,
			nonce: authorizationData.nonce,
			chainId: chainId,
			address: walletAddress,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
			resources: [`canvas://${topic}`],
		}

		const recoveredAddress = verifyMessage(prepareSIWEMessage(siweMessage), hexlify(authorizationData.signature))
		assert(recoveredAddress === walletAddress, "invalid SIWE signature")
	}

	public async getSession(topic: string, options: { timestamp?: number } = {}): Promise<Session<SIWESessionData>> {
		const walletAddress = await this.#ethersSigner.getAddress()
		const address = `eip155:${this.chainId}:${walletAddress}`

		this.log("getting session for %s", address)

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

		this.log("creating new session for %s", address)

		const domain = target.getDomain()
		const nonce = siwe.generateNonce()

		const signer = new Secp256k1Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			address: walletAddress,
			chainId: this.chainId,
			domain: domain,
			uri: signer.uri,
			nonce: nonce,
			issuedAt: issuedAt,
			expirationTime: null,
			resources: [`canvas://${topic}`],
		}

		if (this.sessionDuration !== null) {
			siweMessage.expirationTime = new Date(timestamp + this.sessionDuration).toISOString()
		}

		const signature = await this.#ethersSigner.signMessage(prepareSIWEMessage(siweMessage))

		const session: Session<SIWESessionData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			authorizationData: { signature: getBytes(signature), domain, nonce },
			duration: this.sessionDuration,
			timestamp: timestamp,
			blockhash: null,
		}

		await this.#store.set(topic, address, session, signer)

		this.log("created new session for %s: %o", address, session)
		return session
	}

	public sign(message: Message<Action | Session>): Signature {
		if (message.payload.type === "action") {
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
