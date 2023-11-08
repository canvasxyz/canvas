import { Wallet, verifyMessage } from "ethers"
import { pubkeyType, rawSecp256k1PubkeyToRawAddress, serializeSignDoc } from "@cosmjs/amino"
import { fromBech32, toBech32 } from "@cosmjs/encoding"
import * as json from "@ipld/dag-json"
import * as cbor from "@ipld/dag-cbor"
import { logger } from "@libp2p/logger"
import { secp256k1 } from "@noble/curves/secp256k1"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex, hexToBytes } from "@noble/hashes/utils"
import { base64 } from "multiformats/bases/base64"

import type { Signature, SessionSigner, Action, SessionStore, Message, Session, Signer } from "@canvas-js/interfaces"
import { Secp256k1Signer, didKeyPattern } from "@canvas-js/signed-cid"

import {
	assert,
	signalInvalidType,
	validateSessionData,
	getKey,
	encodeReadableEthereumMessage,
	addressPattern,
	parseAddress,
} from "./utils.js"
import { CosmosMessage, CosmosSessionData, ExternalCosmosSigner } from "./types.js"
import { getSessionSignatureData } from "./signatureData.js"

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
			const wallet = Wallet.createRandom()

			this.#signer = {
				// this wallet is not associated with any chain
				getChainId: async () => "no_chain-id-100",
				getAddress: async () => toBech32(bech32Prefix_, hexToBytes(wallet.address.substring(2))),
				sign: async (cosmosMessage: CosmosMessage) => {
					const msg = encodeReadableEthereumMessage(cosmosMessage)
					const hexSignature = (await wallet.signMessage(msg)).substring(2)
					return {
						signature: hexToBytes(hexSignature),
						signatureType: "ethereum" as const,
					}
				},
			}
		} else if (signer.type == "ethereum") {
			this.#signer = {
				getAddress: async (chainId: string) => {
					const address = (await signer.getAddress(chainId)).substring(2)

					return toBech32(bech32Prefix_, hexToBytes(address))
				},
				getChainId: signer.getChainId,
				sign: async (cosmosMessage: CosmosMessage, signerAddress: string, chainId: string) => {
					const encodedMessage = encodeReadableEthereumMessage(cosmosMessage)

					const ethAddress = `0x${bytesToHex(fromBech32(signerAddress).data)}`
					const hexSignature = await signer.signEthereum(chainId, ethAddress, encodedMessage)
					return {
						signature: hexToBytes(hexSignature.substring(2)),
						signatureType: "ethereum" as const,
					}
				},
			}
		} else if (signer.type == "amino") {
			this.#signer = {
				getAddress: signer.getAddress,
				getChainId: signer.getChainId,
				sign: async (cosmosMessage: CosmosMessage, address: string, chainId: string) => {
					const msg = cbor.encode(cosmosMessage)
					const signDoc = await getSessionSignatureData(msg, address)
					const signRes = await signer.signAmino(chainId, address, signDoc)
					const stdSig = signRes.signature

					return {
						signature: {
							signature: base64.baseDecode(stdSig.signature),
							pub_key: {
								type: pubkeyType.secp256k1,
								value: base64.baseDecode(stdSig.pub_key.value),
							},
							chain_id: chainId,
						},
						signatureType: "amino" as const,
					}
				},
			}
		} else if (signer.type == "bytes") {
			this.#signer = {
				getAddress: signer.getAddress,
				getChainId: signer.getChainId,
				sign: async (cosmosMessage: CosmosMessage) => {
					const msg = cbor.encode(cosmosMessage)
					const { public_key, signature } = await signer.signBytes(msg)
					return {
						signature: {
							signature: base64.baseDecode(signature),
							pub_key: {
								type: pubkeyType.secp256k1,
								value: base64.baseDecode(public_key),
							},
						},
						signatureType: "bytes" as const,
					}
				},
			}
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

		const { prefix } = fromBech32(walletAddress)

		const message: CosmosMessage = {
			address: walletAddress,
			chainId,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}
		const encodedMessage = cbor.encode(message)

		// select verification method based on the signing method
		if (data.signatureType == "ethereum") {
			const encodedReadableMessage = encodeReadableEthereumMessage(message)
			// validate ethereum signature
			const recoveredAddress = verifyMessage(encodedReadableMessage, `0x${bytesToHex(data.signature)}`)
			assert(toBech32(prefix, hexToBytes(recoveredAddress.substring(2))) === walletAddress, "invalid signature")
		} else if (data.signatureType == "amino") {
			// validate cosmos signature
			// recreate amino thingy, do other cosmos dark magic
			// this decodes our serialization "{ pub_key, signature, chain_id? }" to an object with { pubkey, signature }
			const {
				pub_key: { value: pub_key },
				signature,
			} = data.signature

			if (walletAddress !== toBech32(prefix, rawSecp256k1PubkeyToRawAddress(pub_key))) {
				throw new Error("Session signed with a pubkey that doesn't match the session address")
			}

			// the payload can either be signed directly, or encapsulated in a SignDoc
			const signDocPayload = await getSessionSignatureData(encodedMessage, walletAddress)
			const signDocDigest = sha256(serializeSignDoc(signDocPayload))
			const digest = sha256(encodedMessage)

			// compare the signature against the directly signed and signdoc digests
			let isValid = false
			isValid ||= secp256k1.verify(signature, signDocDigest, pub_key)
			isValid ||= secp256k1.verify(signature, digest, pub_key)
			assert(isValid, "invalid signature")
		} else if (data.signatureType == "bytes") {
			const { pub_key, signature } = data.signature
			// cosmos supports other public key types, but for the sake of simplicity
			// just support secp256k1
			assert(pub_key.type == pubkeyType.secp256k1, `invalid public key type ${pub_key.type}`)

			// signBytes signs the sha256 hash of the message
			const hash = sha256(encodedMessage)
			const isValid = secp256k1.verify(signature, hash, pub_key.value)
			assert(isValid, "invalid signature")
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
