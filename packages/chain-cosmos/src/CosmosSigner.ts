import type { Awaitable, Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
import { DAYS } from "@canvas-js/utils"

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
	public readonly match = (address: string) => addressPattern.test(address)
	public readonly bech32Prefix: string

	_signer: GenericSigner

	public constructor({ signer, sessionDuration, bech32Prefix }: CosmosSignerInit = { sessionDuration: 14 * DAYS }) {
		super("chain-cosmos", ed25519, { sessionDuration })

		this.bech32Prefix = bech32Prefix == undefined ? "cosmos" : bech32Prefix

		if (signer == undefined) {
			this._signer = createDefaultSigner(this.bech32Prefix)
		} else if (signer.type == "ethereum") {
			this._signer = createEthereumSigner(signer, this.bech32Prefix)
		} else if (signer.type == "amino") {
			this._signer = createAminoSigner(signer)
		} else if (signer.type == "bytes") {
			this._signer = createBytesSigner(signer)
		} else if (signer.type == "arbitrary") {
			this._signer = createArbitrarySigner(signer)
		} else {
			throw new Error("invalid signer")
		}
	}

	public async verifySession(topic: string, session: Session) {
		const {
			publicKey,
			did,
			authorizationData: data,
			context: { timestamp, duration },
		} = session

		const [chainId, walletAddress] = parseAddress(did)

		const message: CosmosMessage = {
			topic: topic,
			address: walletAddress,
			chainId,
			publicKey: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === undefined ? null : new Date(timestamp + duration).toISOString(),
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

	public async getDid(): Promise<DidIdentifier> {
		const chainId = await this._signer.getChainId()
		const walletAddress = await this._signer.getAddress(chainId)
		const { data } = fromBech32(walletAddress)
		const walletAddressWithPrefix = toBech32(this.bech32Prefix, data)
		return `did:pkh:cosmos:${chainId}:${walletAddressWithPrefix}`
	}

	public getDidParts(): number {
		return 5
	}

	public getAddressFromDid(did: DidIdentifier) {
		const [_, walletAddress] = parseAddress(did)
		return walletAddress
	}

	public async authorize(data: AbstractSessionData): Promise<Session<CosmosSessionData>> {
		const {
			topic,
			did,
			publicKey,
			context: { timestamp, duration },
		} = data
		const [chainId, walletAddress] = parseAddress(did)

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

		const signResult = await this._signer.sign(message, walletAddress, await this._signer.getChainId())

		return {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData: signResult,
			context: duration ? { duration, timestamp } : { timestamp },
		}
	}
}
