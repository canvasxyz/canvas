import { Wallet, verifyMessage } from "ethers"
import { decodeSignature, pubkeyType, rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "@cosmjs/amino"
import { fromBech32, toBech32 } from "@cosmjs/encoding"
import * as json from "@ipld/dag-json"
import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"
import { secp256k1 } from "@noble/curves/secp256k1"
import { sha256 } from "@noble/hashes/sha256"
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
import {
	CosmosMessage,
	CosmosSessionData,
	ExternalCosmosSigner,
	isEvmMetaMaskSigner,
	isKeplrAminoSigner,
	isKeplrEthereumSigner,
	isTerraFixedExtension,
} from "./types.js"
import { getSessionSignatureData } from "./signatureData.js"

export interface CosmosSignerInit {
	signer?: ExternalCosmosSigner
	store?: SessionStore
	sessionDuration?: number
	bech32Prefix?: string
}

type GenericSigner = {
	getAddress: (chainId: string) => Promise<string>
	sign: (msg: Uint8Array, chainId: string) => Promise<CosmosSessionData>
}

export class CosmosSigner implements SessionSigner {
	public readonly sessionDuration: number | null
	private readonly log = logger("canvas:chain-cosmos")

	publicKeyType: SignatureType = "secp256k1"
	#signer: GenericSigner
	#store: SessionStore | null
	#privateKeys: Record<string, Uint8Array> = {}
	#sessions: Record<string, Session<CosmosSessionData>> = {}

	public constructor({ signer, store, sessionDuration, bech32Prefix }: CosmosSignerInit = {}) {
		const bech32Prefix_ = bech32Prefix == undefined ? "cosmos" : bech32Prefix

		if (signer) {
			if (isEvmMetaMaskSigner(signer)) {
				const getAddress = async () => {
					const accounts = await signer.eth.getAccounts()
					const address = accounts[0]
					return toBech32(bech32Prefix_, hexToBytes(address))
				}
				const sign = async (msg: Uint8Array) => {
					const address = await getAddress()
					return {
						signature: await signer.eth.personal.sign(`0x${bytesToHex(msg)}`, address, ""),
						signatureType: "ethereum" as const,
					}
				}
				this.#signer = { getAddress, sign }
			} else if (isKeplrEthereumSigner(signer)) {
				const getAddress = async (chainId: string) => {
					// should chainId be an argument here?
					const accounts = signer.getOfflineSigner(chainId).getAccounts()
					const address = accounts[0].address
					// convert to cosmos address
					return toBech32(bech32Prefix_, hexToBytes(address))
				}
				const sign = async (msg: Uint8Array, chainId: string) => {
					const address = await getAddress(chainId)
					const rawSignature = await signer.signEthereum(chainId, address, bytesToHex(msg), "message")
					return {
						signature: `0x${bytesToHex(rawSignature)}`,
						signatureType: "ethereum" as const,
					}
				}
				this.#signer = { getAddress, sign }
			} else if (isKeplrAminoSigner(signer)) {
				const getAddress = signer.getAddress
				const sign = async (msg: Uint8Array, chainId: string) => {
					const address = await getAddress(chainId)
					const signDoc = await getSessionSignatureData(msg, address)
					const signRes = await signer.signAmino(chainId, address, signDoc)
					const stdSig = signRes.signature
					return {
						signature: {
							signature: stdSig.signature,
							pub_key: {
								type: pubkeyType.secp256k1,
								value: stdSig.pub_key.value,
							},
							chain_id: chainId,
						},
						signatureType: "amino" as const,
					}
				}
				this.#signer = { getAddress, sign }
			} else if (isTerraFixedExtension(signer)) {
				const getAddress = async () => (await signer.connect()).address!
				const sign = async (msg: Uint8Array) => {
					const result = await signer.signBytes(Buffer.from(msg))
					return {
						signature: {
							signature: result.payload.result.signature,
							pub_key: {
								type: pubkeyType.secp256k1,
								value: result.payload.result.public_key,
							},
						},
						signatureType: "cosmos" as const,
					}
				}
				this.#signer = { getAddress, sign }
			} else {
				throw new Error("invalid signer")
			}
		} else {
			const wallet = Wallet.createRandom()

			this.#signer = {
				getAddress: async () => toBech32(bech32Prefix_, hexToBytes(wallet.address.substring(2))),
				sign: async (msg) => {
					const hexMessage = `0x${bytesToHex(msg)}`
					const signature = await wallet.signMessage(hexMessage)
					return {
						signature,
						signatureType: "ethereum" as const,
					}
				},
			}
		}

		this.#store = store ?? null
		this.sessionDuration = sessionDuration ?? null
	}

	public readonly match = (chain: string) => chainPattern.test(chain)

	public async verifySession(session: Session) {
		const { publicKeyType, publicKey, chain, address, data, timestamp, duration } = session
		assert(publicKeyType === this.publicKeyType, `Cosmos sessions must use ${this.publicKeyType} keys`)
		assert(validateSessionData(data), "invalid session")

		const chainId = parseChainId(chain)
		const { prefix } = fromBech32(address)

		const message: CosmosMessage = {
			address,
			chainId,
			uri: getSessionURI(prefix, chainId, publicKey),
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}
		const encodedMessage = cbor.encode(message)

		// select verification method based on the signing method
		if (data.signatureType == "ethereum") {
			// validate ethereum signature
			const recoveredAddress = verifyMessage(`0x${bytesToHex(encodedMessage)}`, data.signature)
			assert(toBech32(prefix, hexToBytes(recoveredAddress.substring(2))) === address, "invalid signature")
		} else if (data.signatureType == "amino") {
			// validate cosmos signature
			// recreate amino thingy, do other cosmos dark magic
			// this decodes our serialization "{ pub_key, signature, chain_id? }" to an object with { pubkey, signature }
			const { pub_key, signature } = data.signature
			const { pubkey, signature: decodedSignature } = decodeSignature({ pub_key, signature })

			if (address !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pubkey))) {
				throw new Error("Session signed with a pubkey that doesn't match the session address")
			}

			// the payload can either be signed directly, or encapsulated in a SignDoc
			const signDocPayload = await getSessionSignatureData(encodedMessage, address)
			const signDocDigest = sha256(serializeSignDoc(signDocPayload))
			const digest = sha256(encodedMessage)

			// compare the signature against the directly signed and signdoc digests
			let isValid = false
			isValid ||= secp256k1.verify(decodedSignature, signDocDigest, pubkey)
			isValid ||= secp256k1.verify(decodedSignature, digest, pubkey)
			assert(isValid, "invalid signature")
		} else if (data.signatureType == "cosmos") {
			throw new Error("Cosmos signatures are not yet supported")
		} else {
			signalInvalidType(data.signatureType)
		}
	}

	public async getSession(
		topic: string,
		options: { chain?: string; timestamp?: number } = {}
	): Promise<Session<CosmosSessionData>> {
		// TODO: where is this passed in from?
		const chain = options.chain ?? "cosmos:osmosis-1"
		assert(chainPattern.test(chain), "internal error - invalid chain")

		const chainId = parseChainId(chain)
		const address = await this.#signer.getAddress(chainId)
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
				const { privateKey, session } = json.parse<{ privateKey: Uint8Array; session: Session<CosmosSessionData> }>(
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

		const privateKey = secp256k1.utils.randomPrivateKey()
		const publicKey = secp256k1.getPublicKey(privateKey)

		const timestamp = options.timestamp ?? Date.now()
		const issuedAt = new Date(timestamp)
		const { prefix } = fromBech32(address)
		const message: CosmosMessage = {
			address,
			chainId,
			uri: getSessionURI(prefix, chainId, publicKey),
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (this.sessionDuration !== null) {
			console.log(issuedAt)
			const expirationTime = new Date(issuedAt.valueOf() + this.sessionDuration)
			console.log(expirationTime)
			message.expirationTime = expirationTime.toISOString()
		}

		const signResult = await this.#signer.sign(cbor.encode(message), chainId)

		const session: Session<CosmosSessionData> = {
			type: "session",
			chain: chain,
			address: address,
			publicKeyType: this.publicKeyType,
			publicKey,
			data: signResult,
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
