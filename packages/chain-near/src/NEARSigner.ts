// import * as cbor from "@ipld/dag-cbor"
import { Buffer } from "buffer"
import * as json from "@ipld/dag-json"
import { logger } from "@libp2p/logger"
import { base64 } from "multiformats/bases/base64"
import { sha256 } from "@noble/hashes/sha256"
// import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { ed25519 } from "@noble/curves/ed25519"
import { KeyPair } from "near-api-js"
import type { Signature, SessionSigner, Action, SessionStore, Message, Session, Signer } from "@canvas-js/interfaces"
import { Ed25519Signer, didKeyPattern } from "@canvas-js/signed-cid"

import {
	assert,
	signalInvalidType,
	validateSessionData,
	getKey,
	// randomKeypair,
	// parseAddress,
	generateHumanReadableNearMessage,
	addressPattern,
} from "./utils.js"
import type { NEARMessage, NEARSessionData } from "./types.js"

type NEARSignerInit = {
	store?: SessionStore
	sessionDuration?: number
	recipient?: string
	network?: string
	wallet?: NEARWallet
}

type SignMessageResult = {
	signature: string
	publicKey: string
}

type NEARWallet = {
	getAccounts: () => Promise<
		{
			accountId: string
		}[]
	>
	signMessage: (args: {
		message: string
		nonce: Buffer
		recipient: string
		callbackUrl: string
	}) => Promise<void | SignMessageResult>
}

type PrivateSessionData = {
	type: string
	privateKey: Uint8Array
	session: Session<NEARSessionData>
}

export class NEARSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-near")

	network: string
	recipient: string
	#wallet: NEARWallet
	#store: SessionStore
	#signers: Record<string, Signer<Message<Action | Session>>> = {}
	#sessions: Record<string, Session<NEARSessionData>> = {}

	public constructor(init: NEARSignerInit) {
		this.network = init.network ?? "mainnet"
		if (init.wallet) {
			this.#wallet = init.wallet
		} else {
			// we want an ed25519 signer
			const privateKey = ed25519.utils.randomPrivateKey()
			const publicKey = ed25519.getPublicKey(privateKey)
			this.#wallet = {
				getAccounts: () => Promise.resolve([{ accountId: base64.baseEncode(publicKey) }]),
				signMessage: async () => {
					throw new Error("unreachable code")
				},
			}
		}

		const placeholderStore = {
			get: async (key: string) => "",
			set: async (key: string, value: string) => {},
			delete: async (key: string) => {},
		}
		this.#store = init.store ? init.store : placeholderStore
		this.recipient = init.recipient ?? "arbitrary-recipient"

		this.sessionDuration = init.sessionDuration ?? null
	}

	public readonly match = (address: string) => addressPattern.test(address)

	public async verifySession(session: Session) {
		const { publicKey: canvasPublicKey, address, data, timestamp, duration } = session

		assert(didKeyPattern.test(canvasPublicKey), "invalid signing key")
		assert(validateSessionData(data), "invalid session")

		const message = generateHumanReadableNearMessage(data.data)
		const hash = sha256(message)
		// data.

		const decodedPublicKey = base64.baseDecode(data.publicKey.split(":")[1])

		console.log(data.signature)
		console.log(hash)
		console.log(decodedPublicKey)
		const isValid = ed25519.verify(data.signature, message, decodedPublicKey)
		console.log("isValid", isValid)

		throw new Error("TODO: implement verifySession")

		// const [chainId, walletAddress] = parseAddress(address)

		// const issuedAt = new Date(timestamp).toISOString()
		// const message: SubstrateMessage = {
		// 	address,
		// 	chainId,
		// 	uri: publicKey,
		// 	issuedAt,
		// 	expirationTime: null,
		// }

		// const decodedAddress = decodeAddress(walletAddress)

		// const substrateKeyType = data.substrateKeyType
		// some cryptography code used by polkadot requires a wasm environment which is initialised
		// asynchronously so we have to wait for it to be ready
		// await cryptoWaitReady()
		// const signerKeyring = new Keyring({
		// 	type: substrateKeyType,
		// 	ss58Format: 42,
		// }).addFromAddress(decodedAddress)

		// const valid = signerKeyring.verify(bytesToHex(cbor.encode(message)), data.signature, decodedAddress)

		// assert(valid, "invalid signature")
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<NEARSessionData>> {
		const accounts = await this.#wallet.getAccounts()
		const walletAddress = accounts[0].accountId
		const address = `near:${this.network}:${walletAddress}`

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

		const privateSessionData = await this.#store.get(key)
		if (privateSessionData !== null) {
			const { type, privateKey, session } = json.parse<PrivateSessionData>(privateSessionData)
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

		this.log("creating new session for %s", key)

		// create a keypair
		const signer = new Ed25519Signer()

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp).toISOString()

		const nonceString = crypto.randomUUID().substring(0, 32)
		const nonce = Buffer.from(nonceString)

		const message: NEARMessage = {
			walletAddress,
			chainId: this.network,
			uri: signer.uri,
			issuedAt,
			expirationTime: null,
			recipient: this.recipient,
			nonce: nonceString,
		}

		// we should be able to reconstruct the near message from the redirect url
		const callbackUrlParams = { ...message, finishNearLogin: "true", topic }
		const callbackUrlParamString = Object.entries(callbackUrlParams)
			.map(([key, value]) => `${key}=${value}`)
			.join("&")

		const { type, privateKey } = signer.export()
		await this.#store.set(key, json.stringify({ type, privateKey }))

		const signMessageResult = await this.#wallet.signMessage({
			message: generateHumanReadableNearMessage(message),
			nonce,
			recipient: this.recipient,
			callbackUrl: `${window.location.origin}/?${callbackUrlParamString}`,
		})

		if (signMessageResult) {
			// this code is reached if we are signing with a wallet that does not support the redirect flow
			// such as an ephemeral keypair
			const { signature, publicKey } = signMessageResult
			return await this.saveSession(message, signature, publicKey, { timestamp, topic })
		} else {
			throw new Error("unreachable code")
		}
	}

	public async saveSession(
		message: NEARMessage,
		signature: string,
		publicKey: string,
		options: { timestamp: number; topic: string }
	) {
		const address = `near:${this.network}:${message.walletAddress}`

		const session: Session<NEARSessionData> = {
			type: "session",
			address,
			publicKey: message.uri,
			data: { signature: base64.baseDecode(signature), data: message, nonce: message.nonce, publicKey },
			blockhash: null,
			timestamp: options.timestamp,
			duration: this.sessionDuration,
		}

		// get the signer that was saved by getSession\
		const key = getKey(options.topic, address)
		const privateSessionData = await this.#store.get(key)
		if (privateSessionData === null) {
			throw new Error("private key not found")
		}

		const { type, privateKey } = json.parse<PrivateSessionData>(privateSessionData)
		assert(type === "ed25519", "unexpected signature type")
		const signer = new Ed25519Signer(privateKey)

		// save the session and private key in the cache and the store
		this.#signers[key] = signer
		this.#sessions[key] = session
		await this.#store.set(key, json.stringify({ type, privateKey, session }))

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
			throw new Error("...")
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
