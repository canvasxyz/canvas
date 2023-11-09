import * as cbor from "@ipld/dag-cbor"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { Keyring } from "@polkadot/keyring"
import type { Signature, SessionSigner, Action, SessionStore, Message, Session, Signer } from "@canvas-js/interfaces"
import { InjectedExtension } from "@polkadot/extension-inject/types"

import { Ed25519Signer, didKeyPattern } from "@canvas-js/signed-cid"

import {
	assert,
	signalInvalidType,
	validateSessionData,
	getKey,
	randomKeypair,
	parseAddress,
	addressPattern,
} from "./utils.js"
import type { SubstrateMessage, SubstrateSessionData } from "./types.js"
import { cryptoWaitReady, decodeAddress } from "@polkadot/util-crypto"
import { KeypairType } from "@polkadot/util-crypto/types.js"

type SubstrateSignerInit = {
	store?: SessionStore
	sessionDuration?: number
	extension?: InjectedExtension
	substrateKeyType?: KeypairType
}

type AbstractSigner = {
	// substrate wallets support a variety of key pair types, such as sr25519, ed25519, and ecdsa
	getSubstrateKeyType: () => Promise<KeypairType>
	getAddress: () => Promise<string>
	getChainId: () => Promise<string>
	signMessage(message: Uint8Array): Promise<Uint8Array>
}

export class SubstrateSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-substrate")

	// some type that overlaps with the injected extension and
	// a generated wallet
	#signer: AbstractSigner
	#store: SessionStore | null
	#signers: Record<string, Signer<Message<Action | Session>>> = {}
	#sessions: Record<string, Session<SubstrateSessionData>> = {}

	public constructor(init: SubstrateSignerInit) {
		if (init.extension) {
			const { extension } = init

			const signRaw = extension.signer.signRaw
			if (signRaw === undefined) {
				throw new Error("Invalid signer - no signRaw method exists")
			}
			this.#signer = {
				getSubstrateKeyType: async () => {
					const account = await extension.accounts.get()
					return account[0].type || "sr25519"
				},
				getAddress: async () => {
					const account = await extension.accounts.get()
					return account[0].address
				},
				getChainId: async () => {
					let genesisHash = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"
					const account = await extension.accounts.get()
					if (account[0].genesisHash) genesisHash = account[0].genesisHash
					return genesisHash.slice(2, 34)
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
			const keyType: KeypairType = init.substrateKeyType ?? "sr25519"

			// some of the cryptography methods used by polkadot require a wasm environment which is initialised
			// asynchronously so we have to lazily create the keypair when it is needed
			let keyring: ReturnType<Keyring["addFromMnemonic"]> | undefined
			this.#signer = {
				getSubstrateKeyType: async () => {
					return keyType
				},
				getAddress: async () => {
					await cryptoWaitReady()
					if (!keyring) {
						keyring = randomKeypair(keyType)
					}
					return keyring.address
				},
				getChainId: async () => {
					const genesisHash = "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3"
					return genesisHash.slice(2, 34)
				},
				signMessage: async (data: Uint8Array) => {
					await cryptoWaitReady()
					if (!keyring) {
						keyring = randomKeypair(keyType)
					}
					return keyring.sign(bytesToHex(data))
				},
			}
		}

		// this.#signer =
		this.#store = init.store ?? null
		this.sessionDuration = init.sessionDuration ?? null
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public async verifySession(session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session

		assert(didKeyPattern.test(publicKey), "invalid signing key")
		assert(validateSessionData(data), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const issuedAt = new Date(timestamp).toISOString()
		const message: SubstrateMessage = {
			address,
			chainId,
			uri: publicKey,
			issuedAt,
			expirationTime: null,
		}

		const decodedAddress = decodeAddress(walletAddress)

		const substrateKeyType = data.substrateKeyType
		// some cryptography code used by polkadot requires a wasm environment which is initialised
		// asynchronously so we have to wait for it to be ready
		await cryptoWaitReady()
		const signerKeyring = new Keyring({
			type: substrateKeyType,
			ss58Format: 42,
		}).addFromAddress(decodedAddress)

		const valid = signerKeyring.verify(bytesToHex(cbor.encode(message)), data.signature, decodedAddress)

		assert(valid, "invalid signature")
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<SubstrateSessionData>> {
		const chainId = await this.#signer.getChainId()
		const walletAddress = await this.#signer.getAddress()
		const address = `polkadot:${chainId}:${walletAddress}`

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
					type: string
					privateKey: Uint8Array
					session: Session<SubstrateSessionData>
				}>(privateSessionData)
				assert(type === "ed25519", "unexpected signature type")

				if (options.timestamp === undefined) {
					this.#sessions[key] = session
					this.#signers[key] = new Ed25519Signer(privateKey)
					this.log("found session %s in store: %o", key, session)
					return session
				} else if (
					options.timestamp >= session.timestamp &&
					options.timestamp <= session.timestamp + (session.duration ?? Infinity)
				) {
					this.#sessions[key] = session
					this.#signers[key] = new Ed25519Signer(privateKey)
					this.log("found session %s in store: %o", key, session)
					return session
				} else {
					this.log("stored session %s has expired", key)
				}
			}
		}

		this.log("creating new session for %s", key)

		// create a keypair
		const signer = new Ed25519Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const message: SubstrateMessage = {
			address,
			chainId,
			uri: signer.uri,
			issuedAt,
			expirationTime: null,
		}

		const signature = await this.#signer.signMessage(cbor.encode(message))
		const substrateKeyType = await this.#signer.getSubstrateKeyType()

		const session: Session<SubstrateSessionData> = {
			type: "session",
			address,
			publicKey: signer.uri,
			authorizationData: { signature, data: message, substrateKeyType },
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
