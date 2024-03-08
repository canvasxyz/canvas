import type { Session } from "@canvas-js/interfaces"
import { AbstractSessionData, AbstractSessionSigner, Ed25519DelegateSigner } from "@canvas-js/signatures"
import { assert, signalInvalidType } from "@canvas-js/utils"

import { validateSessionData, addressPattern, parseAddress } from "./utils.js"
import { CosmosMessage, CosmosSessionData, ExternalCosmosSigner } from "./types.js"
import { createDefaultSigner } from "./external_signers/default.js"
import { createEthereumSigner, verifyEthereum } from "./external_signers/ethereum.js"
import { createAminoSigner, verifyAmino } from "./external_signers/amino.js"
import { createBytesSigner, verifyBytes } from "./external_signers/bytes.js"

export interface CosmosSignerInit {
	signer?: ExternalCosmosSigner
	sessionDuration?: number
	bech32Prefix?: string
}

type GenericSigner = {
	getChainId: () => Promise<string>
	getAddress: (chainId: string) => Promise<string>
	sign: (msg: CosmosMessage, signerAddress: string, chainId: string) => Promise<CosmosSessionData>
}

export class CosmosSigner extends AbstractSessionSigner<CosmosSessionData> {
	public readonly codecs = [Ed25519DelegateSigner.cborCodec, Ed25519DelegateSigner.jsonCodec]

	#signer: GenericSigner

	public constructor({ signer, sessionDuration, bech32Prefix }: CosmosSignerInit = {}) {
		super("chain-cosmos", { createSigner: (init) => new Ed25519DelegateSigner(init), defaultDuration: sessionDuration })

		const bech32Prefix_ = bech32Prefix == undefined ? "cosmos" : bech32Prefix

		if (signer == undefined) {
			this.#signer = createDefaultSigner(bech32Prefix_)
		} else if (signer.type == "ethereum") {
			this.#signer = createEthereumSigner(signer, bech32Prefix_)
		} else if (signer.type == "amino") {
			this.#signer = createAminoSigner(signer)
		} else if (signer.type == "bytes") {
			this.#signer = createBytesSigner(signer)
		} else {
			throw new Error("invalid signer")
		}
	}

	public readonly match = (address: string) => addressPattern.test(address)
	public readonly verify = Ed25519DelegateSigner.verify

	public async verifySession(topic: string, session: Session) {
		const { publicKey, address, authorizationData: data, timestamp, duration } = session

		assert(validateSessionData(data), "invalid session")
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
			verifyEthereum(message, data)
		} else if (data.signatureType == "amino") {
			await verifyAmino(message, data)
		} else if (data.signatureType == "bytes") {
			verifyBytes(message, data)
		} else {
			signalInvalidType(data.signatureType)
		}
	}

	protected async getAddress(): Promise<string> {
		const chainId = await this.#signer.getChainId()
		const walletAddress = await this.#signer.getAddress(chainId)
		return `cosmos:${chainId}:${walletAddress}`
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
