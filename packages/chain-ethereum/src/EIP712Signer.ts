import { AbstractSigner, Wallet, hexlify, getBytes, verifyTypedData, zeroPadValue, getAddress } from "ethers"
import { logger } from "@libp2p/logger"

import type { Signature, SessionSigner, Action, Message, Session } from "@canvas-js/interfaces"
import { Secp256k1Signer, didKeyPattern } from "@canvas-js/signed-cid"

import target from "#target"

import type { EIP712AuthorizationData, EIP712SessionMessage } from "./types.js"
import {
	assert,
	signalInvalidType,
	parseAddress,
	addressPattern,
	validateEIP712AuthorizationData,
	DAYS,
} from "./utils.js"

export interface EIP712SignerInit {
	signer?: AbstractSigner
	sessionDuration?: number
	// chainId is not currently used in the domain separator
	chainId?: number // optional
}

// The `address` delegates authority to the `publicKey` to sign individual actions.
//
// Because it's still unclear which ETH DID URIs we should use, the public key is
// encoded as an ECDSA did:key pubkey, which can be translated into an Ethereum
// address without too much difficulty.
export const eip712TypeDefinitions = {
	Session: [
		{ name: "address", type: "address" },
		{ name: "blockhash", type: "string" }, // optional
		{ name: "duration", type: "uint256" },
		{ name: "publicKey", type: "string" },
		{ name: "timestamp", type: "uint256" },
	],
}

export class EIP712Signer implements SessionSigner<EIP712AuthorizationData> {
	public readonly key: string
	public readonly sessionDuration: number
	public readonly chainId: number

	private readonly log = logger("canvas:chain-ethereum")

	#store = target.getSessionStore()
	#ethersSigner: AbstractSigner

	public constructor(init: EIP712SignerInit = {}) {
		this.#ethersSigner = init.signer ?? Wallet.createRandom()
		this.sessionDuration = init.sessionDuration ?? 14 * DAYS
		this.chainId = init.chainId ?? 1
		this.key = `EIP712Signer-${init.signer ? "signer" : "burner"}`
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public verifySession(topic: string, session: Session<EIP712AuthorizationData>) {
		const { publicKey, address, authorizationData, timestamp, blockhash, duration } = session

		assert(didKeyPattern.test(publicKey), "invalid signing key")
		assert(validateEIP712AuthorizationData(authorizationData), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const message: EIP712SessionMessage = {
			address: walletAddress,
			blockhash,
			duration,
			publicKey,
			timestamp,
		}

		const { signature } = authorizationData

		const recoveredAddress = verifyTypedData({ name: topic }, eip712TypeDefinitions, message, hexlify(signature))
		assert(recoveredAddress === walletAddress, "invalid SIWE signature")
	}

	public async getSession(
		topic: string,
		options: { timestamp?: number; fromCache?: boolean } = {},
	): Promise<Session<EIP712AuthorizationData>> {
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

		if (options.fromCache) return Promise.reject()

		this.log("creating new session for %s", address)

		const signer = new Secp256k1Signer()

		const timestamp = options.timestamp ?? Date.now()

		const message = {
			address: walletAddress,
			publicKey: signer.uri,
			blockhash: "",
			timestamp,
			duration: this.sessionDuration,
		}

		const signature = await this.#ethersSigner.signTypedData({ name: topic }, eip712TypeDefinitions, message)

		const session: Session<EIP712AuthorizationData> = {
			type: "session",
			address: address,
			publicKey: signer.uri,
			authorizationData: { signature: getBytes(signature) },
			duration: this.sessionDuration,
			timestamp: timestamp,
			blockhash: "",
		}

		this.#store.set(topic, address, session, signer)

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

			return signer.sign(message, { codec: "raw", digest: "raw" })
		} else if (message.payload.type === "session") {
			const { signer, session } = this.#store.get(message.topic, message.payload.address) ?? {}
			assert(signer !== undefined && session !== undefined)

			// only sign our own current sessions
			assert(message.payload === session)
			return signer.sign(message, { codec: "raw", digest: "raw" })
		} else {
			signalInvalidType(message.payload)
		}
	}

	public async clear(topic: string) {
		this.#store.clear(topic)
	}
}
