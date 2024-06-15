import * as cbor from "@ipld/dag-cbor"
import { KeyPair } from "near-api-js"
import { PublicKey } from "@near-js/crypto"
import { ed25519 } from "@noble/curves/ed25519"

import type { Session, AbstractSessionData } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 as Ed25519SignatureScheme } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import { NEARMessage, NEARSessionData } from "./types.js"
import { validateSessionData, addressPattern, parseAddress } from "./utils.js"

export interface NEARSignerInit {
	chainId?: string
	keyPair?: KeyPair
	sessionDuration?: number
}

export class NEARSigner extends AbstractSessionSigner<NEARSessionData> {
	public readonly match = (chain: string) => addressPattern.test(chain)
	public readonly chainId: string

	#address: string
	#keyPair: KeyPair

	public constructor({ keyPair, sessionDuration, chainId }: NEARSignerInit = {}) {
		super("chain-near", Ed25519SignatureScheme, { sessionDuration })

		this.#keyPair = keyPair ?? KeyPair.fromRandom("ed25519")
		this.#address = this.#keyPair.getPublicKey().toString().split(":")[1]

		this.chainId = chainId ?? "near:mainnet"
	}

	public verifySession(topic: string, session: Session) {
		const {
			publicKey,
			address,
			authorizationData: data,
			context: { timestamp, duration },
		} = session
		assert(validateSessionData(data), "invalid session")
		const [chain, walletAddress] = parseAddress(address)

		const walletAddressFromPublicKey = new PublicKey({ keyType: 0, data: data.publicKey }).toString().split(":")[1]
		assert(walletAddress == walletAddressFromPublicKey, "the wallet address does not match the public key")

		const issuedAt = new Date(timestamp).toISOString()
		const message: NEARMessage = {
			topic,
			publicKey,
			issuedAt,
			expirationTime: null,
		}

		if (duration !== undefined) {
			message.expirationTime = new Date(timestamp + duration).toISOString()
		}

		const valid = ed25519.verify(data.signature, cbor.encode(message), data.publicKey)
		assert(valid, "invalid signature")
	}

	public getAddress(): string {
		const walletAddress = this.#address
		return `${this.chainId}:${walletAddress}`
	}

	public getAddressParts(): number {
		return 5
	}

	public async authorize(data: AbstractSessionData): Promise<Session<NEARSessionData>> {
		const {
			topic,
			address,
			publicKey,
			context: { timestamp, duration },
		} = data
		const issuedAt = new Date(timestamp)

		const message: NEARMessage = {
			topic,
			publicKey: publicKey,
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (duration !== null) {
			console.log(issuedAt)
			const expirationTime = new Date(timestamp + duration)
			console.log(expirationTime)
			message.expirationTime = expirationTime.toISOString()
		}

		const {
			signature,
			publicKey: { data: publicKeyData },
		} = this.#keyPair.sign(cbor.encode(message))

		return {
			type: "session",
			address: address,
			publicKey: publicKey,
			authorizationData: { signature, publicKey: publicKeyData },
			context: duration ? { duration, timestamp } : { timestamp },
		}
	}
}
