import type { Awaitable, Session } from "@canvas-js/interfaces"
import { AbstractSessionData, AbstractSessionSigner, Ed25519DelegateSigner } from "@canvas-js/signatures"

import { addressPattern, parseAddress } from "./utils.js"
import { CosmosMessage, CosmosSessionData, ExternalCosmosSigner } from "./types.js"
import { createDefaultSigner } from "./external_signers/default.js"
import { createEthereumSigner, validateEthereumSignedSessionData, verifyEthereum } from "./external_signers/ethereum.js"
import { createAminoSigner, validateAminoSignedSessionData, verifyAmino } from "./external_signers/amino.js"
import { createBytesSigner, validateBytesSignedSessionData, verifyBytes } from "./external_signers/bytes.js"
import {
	createArbitrarySigner,
	validateArbitrarySignedSessionData,
	verifyArbitrary,
} from "./external_signers/arbitrary.js"
import { fromBech32, toBech32 } from "@cosmjs/encoding"

export interface CosmosSignerInit {
	signer?: ExternalCosmosSigner
	sessionDuration?: number
	bech32Prefix?: string
}

type GenericSigner = {
	getChainId: () => Awaitable<string>
	getAddress: (chainId: string) => Awaitable<string>
	sign: (msg: CosmosMessage, signerAddress: string, chainId: string) => Awaitable<CosmosSessionData>
}

export class CosmosSigner extends AbstractSessionSigner<CosmosSessionData> {
	public readonly codecs = [Ed25519DelegateSigner.cborCodec, Ed25519DelegateSigner.jsonCodec]
	public readonly bech32Prefix: string

	#signer: GenericSigner

	public constructor({ signer, sessionDuration, bech32Prefix }: CosmosSignerInit = {}) {
		super("chain-cosmos", { createSigner: (init) => new Ed25519DelegateSigner(init), defaultDuration: sessionDuration })

		this.bech32Prefix = bech32Prefix == undefined ? "cosmos" : bech32Prefix

		if (signer == undefined) {
			this.#signer = createDefaultSigner(this.bech32Prefix)
		} else if (signer.type == "ethereum") {
			this.#signer = createEthereumSigner(signer, this.bech32Prefix)
		} else if (signer.type == "amino") {
			this.#signer = createAminoSigner(signer)
		} else if (signer.type == "bytes") {
			this.#signer = createBytesSigner(signer)
		} else if (signer.type == "arbitrary") {
			this.#signer = createArbitrarySigner(signer)
		} else {
			throw new Error("invalid signer")
		}
	}

	public readonly match = (address: string) => addressPattern.test(address)
	public readonly verify = Ed25519DelegateSigner.verify

	public async verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session

		const [chainId, walletAddress] = parseAddress(address)

		const message: CosmosMessage = {
			topic: topic,
			address: walletAddress,
			chainId,
			publicKey: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
		}

		// select verification method based on the signing method
		if (data.signatureType == "ethereum") {
			if (!validateEthereumSignedSessionData(data)) {
				throw new Error("invalid ethereum session data")
			}
			verifyEthereum(message, data)
		} else if (data.signatureType == "amino") {
			if (!validateAminoSignedSessionData(data)) {
				throw new Error("invalid amino session data")
			}
			await verifyAmino(message, data)
		} else if (data.signatureType == "bytes") {
			if (!validateBytesSignedSessionData(data)) {
				throw new Error("invalid bytes session data")
			}
			verifyBytes(message, data)
		} else if (data.signatureType == "arbitrary") {
			if (!validateArbitrarySignedSessionData(data)) {
				throw new Error("invalid arbitrary session data")
			}
			await verifyArbitrary(message, data)
		} else {
			throw new Error("invalid signature type")
		}
	}

	protected async getAddress(): Promise<string> {
		const chainId = await this.#signer.getChainId()
		const walletAddress = await this.#signer.getAddress(chainId)
		const { data } = fromBech32(walletAddress)
		const walletAddressWithPrefix = toBech32(this.bech32Prefix, data)
		return `cosmos:${chainId}:${walletAddressWithPrefix}`
	}

	protected async newSession(data: AbstractSessionData): Promise<Session<CosmosSessionData>> {
		const { topic, address, timestamp, publicKey, duration } = data
		const [chainId, walletAddress] = parseAddress(address)

		const issuedAt = new Date(timestamp)
		const message: CosmosMessage = {
			topic: topic,
			address: walletAddress,
			chainId,
			publicKey: publicKey,
			issuedAt: issuedAt.toISOString(),
			expirationTime: null,
		}

		if (duration !== null) {
			message.expirationTime = new Date(timestamp + duration).toISOString()
		}

		const signResult = await this.#signer.sign(message, walletAddress, chainId)

		return {
			type: "session",
			address: address,
			publicKey: publicKey,
			authorizationData: signResult,
			blockhash: null,
			timestamp: timestamp,
			duration: duration,
		}
	}
}
