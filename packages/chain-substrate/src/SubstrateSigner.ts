import * as json from "@ipld/dag-json"
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils"
import { Keyring } from "@polkadot/keyring"
import { InjectedExtension } from "@polkadot/extension-inject/types"

import { cryptoWaitReady, decodeAddress } from "@polkadot/util-crypto"
import { KeypairType } from "@polkadot/util-crypto/types"

import type { Awaitable, Session } from "@canvas-js/interfaces"
import { AbstractSessionData, AbstractSessionSigner, Ed25519DelegateSigner } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import type { SubstrateMessage, SubstrateSessionData } from "./types.js"
import { validateSessionData, randomKeypair, parseAddress, addressPattern } from "./utils.js"

const constructSubstrateMessage = (message: SubstrateMessage) => {
	return json.encode(message)
}

type SubstrateSignerInit = {
	sessionDuration?: number
	extension?: InjectedExtension
	substrateKeyType?: KeypairType
}

type AbstractSigner = {
	// substrate wallets support a variety of key pair types, such as sr25519, ed25519, and ecdsa
	getSubstrateKeyType: () => Awaitable<KeypairType>
	getAddress: () => Awaitable<string>
	getChainId: () => Awaitable<string>
	signMessage(message: Uint8Array): Awaitable<{
		signature: Uint8Array
		nonce: Uint8Array
	}>
}

export class SubstrateSigner extends AbstractSessionSigner<SubstrateSessionData> {
	public readonly codecs = [Ed25519DelegateSigner.cborCodec, Ed25519DelegateSigner.jsonCodec]
	public readonly match = (address: string) => addressPattern.test(address)
	public readonly verify = Ed25519DelegateSigner.verify

	// some type that overlaps with the injected extension and
	// a generated wallet
	#signer: AbstractSigner

	public constructor({ sessionDuration, substrateKeyType, extension }: SubstrateSignerInit = {}) {
		super("chain-substrate", {
			createSigner: (init) => new Ed25519DelegateSigner(init),
			defaultDuration: sessionDuration,
		})
		if (extension) {
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

					const nonce = randomBytes(16)
					const data = bytesToHex(nonce) + bytesToHex(message)

					const signerResult = await signRaw({ address, data, type: "bytes" })
					const signature = signerResult.signature
					// signerResult.signature is encoded as 0x{hex}, just get the hex part
					return {
						signature: hexToBytes(signature.slice(2)),
						nonce,
					}
				},
			}
		} else {
			const keyType: KeypairType = substrateKeyType ?? "sr25519"

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
				signMessage: async (message: Uint8Array) => {
					await cryptoWaitReady()
					if (!keyring) {
						keyring = randomKeypair(keyType)
					}
					const decodedAddress = decodeAddress(keyring.address)

					// there is a bug in polkadot's ECDSA implementation which means that sometimes
					// it produces a signature that is not valid, this happens in about 1 in 200 times
					// since sign and verify are deterministic, we can check that the signature is valid
					// before returning it. If it is not valid, we try again with a new nonce
					let attemptsRemaining = 3
					while (attemptsRemaining > 0) {
						const nonce = randomBytes(16)
						const data = bytesToHex(nonce) + bytesToHex(message)
						const signature = keyring.sign(data)

						// check the signature is valid before returning it
						if (keyring.verify(data, signature, decodedAddress)) {
							return {
								signature,
								nonce,
							}
						} else {
							attemptsRemaining--
						}
					}
					throw new Error("Failed to generate a valid signature")
				},
			}
		}
	}

	public async verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData, timestamp, duration } = session

		assert(validateSessionData(authorizationData), "invalid session")
		const [chainId, walletAddress] = parseAddress(address)

		const issuedAt = new Date(timestamp).toISOString()
		const message: SubstrateMessage = {
			topic: topic,
			address: walletAddress,
			chainId,
			uri: publicKey,
			issuedAt,
			expirationTime: null,
		}

		const decodedAddress = decodeAddress(walletAddress)

		const substrateKeyType = authorizationData.substrateKeyType
		// some cryptography code used by polkadot requires a wasm environment which is initialised
		// asynchronously so we have to wait for it to be ready
		await cryptoWaitReady()
		const signerKeyring = new Keyring({
			type: substrateKeyType,
			ss58Format: 42,
		}).addFromAddress(decodedAddress)

		const { nonce, signature } = authorizationData.signatureResult
		const signedData = bytesToHex(nonce) + bytesToHex(constructSubstrateMessage(message))

		const valid = signerKeyring.verify(signedData, signature, decodedAddress)

		assert(valid, "invalid signature")
	}

	protected async getAddress(): Promise<string> {
		const chainId = await this.#signer.getChainId()
		const walletAddress = await this.#signer.getAddress()
		return `polkadot:${chainId}:${walletAddress}`
	}

	protected async newSession(data: AbstractSessionData): Promise<Session<SubstrateSessionData>> {
		const { topic, address, publicKey, timestamp, duration } = data
		const issuedAt = new Date(timestamp).toISOString()

		const [chainId, walletAddress] = parseAddress(address)

		const message: SubstrateMessage = {
			topic,
			address: walletAddress,
			chainId,
			uri: publicKey,
			issuedAt,
			expirationTime: null,
		}

		const signatureResult = await this.#signer.signMessage(constructSubstrateMessage(message))
		const substrateKeyType = await this.#signer.getSubstrateKeyType()

		return {
			type: "session",
			address,
			publicKey: publicKey,
			authorizationData: { signatureResult, data: message, substrateKeyType },
			blockhash: null,
			timestamp: timestamp,
			duration: duration,
		}
	}
}
