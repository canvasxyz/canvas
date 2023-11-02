import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import type {
	Signature,
	SessionSigner,
	Action,
	SessionStore,
	Message,
	Session,
	SignatureType,
} from "@canvas-js/interfaces"
import { ed25519 } from "@noble/curves/ed25519"
import { InjectedExtension } from "@polkadot/extension-inject/types"

import { createSignature } from "@canvas-js/signed-cid"

import {
	assert,
	signalInvalidType,
	validateSessionData,
	parseChainId,
	chainPattern,
	getSessionURI,
	getKey,
} from "./utils.js"
import type { SubstrateMessage, SubstrateSessionData } from "./types.js"
import { encodeAddress } from "@polkadot/util-crypto"

type SubstrateSignerInit = {
	store?: SessionStore
	sessionDuration?: number
	extension?: InjectedExtension
}

type AbstractSigner = {
	getAddress: () => Promise<string>
	signMessage(message: Uint8Array): Promise<Uint8Array>
}

export class SubstrateSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-substrate")

	publicKeyType: SignatureType = "ed25519"
	// some type that overlaps with the injected extension and
	// a generated wallet
	#signer: AbstractSigner
	#store: SessionStore | null
	// these function as the private keys
	#privateKeys: Record<string, Uint8Array> = {}
	#sessions: Record<string, Session<SubstrateSessionData>> = {}

	public constructor(init: SubstrateSignerInit) {
		if (init.extension) {
			const { extension } = init

			const signRaw = extension.signer.signRaw
			if (signRaw === undefined) {
				throw new Error("Invalid signer - no signRaw method exists")
			}
			this.#signer = {
				getAddress: async () => {
					const account = await extension.accounts.get()
					return account[0].address
				},
				signMessage: async (message: Uint8Array) => {
					const account = await extension.accounts.get()
					const address = account[0].address
					const signerResult = await signRaw({ address, data: bytesToHex(message), type: "bytes" })
					const signature = signerResult.signature
					// signerResult.signature is encoded as 0x{hex}, just get the hex part
					return hexToBytes(signature.slice(2))
				},
			}
		} else {
			const privateKey = ed25519.utils.randomPrivateKey()
			const publicKey = ed25519.getPublicKey(privateKey)
			const address = encodeAddress(publicKey)
			this.#signer = {
				getAddress: async () => address,
				signMessage: async (data: Uint8Array) => createSignature("ed25519", data, privateKey).signature,
			}
		}

		// this.#signer =
		this.#store = init.store ?? null
		this.sessionDuration = init.sessionDuration ?? null
	}

	public readonly match = (chain: string) => chainPattern.test(chain)

	public verifySession(session: Session) {
		const { publicKeyType, publicKey, chain, address, data, timestamp, duration } = session
		// TODO: validate the publickeytype
		assert(publicKeyType === undefined, "___ sessions must use ___ keys")

		// TODO: validate that the session data is well formed
		assert(validateSessionData(data), "invalid session")

		// TODO: recreate the message that was signed from the session data
		const chainId = parseChainId(chain)
		const issuedAt = new Date(timestamp).toISOString()
		const message: SubstrateMessage = {
			address,
			chainId,
			uri: getSessionURI(chain, publicKey),
			issuedAt,
			expirationTime: null,
		}

		const valid = ed25519.verify(cbor.encode(message), data.signature, publicKey)
		assert(valid, "invalid signature")
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<SubstrateSessionData>> {
		const genesisHash = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"
		const chainId = genesisHash.slice(2, 34)
		const chain = options.chain ?? `polkadot:${chainId}`
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
				// TODO: parse the private session data
				const { privateKey, session } = json.parse<{ privateKey: Uint8Array; session: Session<SubstrateSessionData> }>(
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

		// create a keypair
		const privateKey = ed25519.utils.randomPrivateKey()
		const publicKey = ed25519.getPublicKey(privateKey)

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const message: SubstrateMessage = {
			address,
			chainId,
			uri: getSessionURI(chain, publicKey),
			issuedAt,
			expirationTime: null,
		}

		const signature = await this.#signer.signMessage(cbor.encode(message))

		const session: Session<SubstrateSessionData> = {
			type: "session",
			chain: chain,
			address: address,
			publicKeyType: this.publicKeyType,
			publicKey: publicKey,
			data: { signature: signature, data: message },
			blockhash: null,
			timestamp,
			duration: this.sessionDuration,
		}

		// save the session and private key in the cache and the store
		this.#sessions[key] = session
		this.#privateKeys[key] = privateKey
		if (this.#store !== null) {
			await this.#store.set(key, json.stringify({ privateKey, session }))
		}

		this.log("created new session for %s: %o", key, session)
		return session
	}

	// i think this method might be totally generic, maybe we could factor it out
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

			return createSignature(this.publicKeyType, privateKey, {
				topic,
				clock,
				parents,
				payload,
			} satisfies Message<Action>)
		} else if (payload.type === "session") {
			const { chain, address } = payload
			const key = getKey(topic, chain, address)
			const session = this.#sessions[key]
			const privateKey = this.#privateKeys[key]
			assert(session !== undefined && privateKey !== undefined)

			// only sign our own current sessions
			assert(payload === session)

			return createSignature(this.publicKeyType, privateKey, {
				topic,
				clock,
				parents,
				payload,
			} satisfies Message<Session>)
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
