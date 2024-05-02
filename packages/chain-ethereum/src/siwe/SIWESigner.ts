import { Wallet, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"

import type { Session, AbstractSessionData } from "@canvas-js/interfaces"
import { AbstractSessionSigner, Ed25519DelegateSigner, Ed25519SignatureScheme } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

import type { SIWESessionData, SIWEMessage } from "./types.js"
import {
	SIWEMessageVersion,
	validateSIWESessionData,
	prepareSIWEMessage,
	parseAddress,
	addressPattern,
} from "./utils.js"

type AbstractSigner = {
	getAddress(): Promise<string>
	signMessage(message: string): Promise<string>
}

export interface SIWESignerInit {
	chainId?: number
	signer?: AbstractSigner
	sessionDuration?: number
}

export class SIWESigner extends AbstractSessionSigner<SIWESessionData> {
	public readonly match = (address: string) => addressPattern.test(address)

	public readonly key: string
	public readonly chainId: number

	#signer: AbstractSigner

	public constructor({ sessionDuration, ...init }: SIWESignerInit = {}) {
		super("chain-ethereum", Ed25519SignatureScheme, { sessionDuration })

		this.#signer = init.signer ?? Wallet.createRandom()
		this.chainId = init.chainId ?? 1
		this.key = `SIWESigner-${init.signer ? "signer" : "burner"}`
	}

	public async getAddress(): Promise<string> {
		const walletAddress = await this.#signer.getAddress()
		return `eip155:${this.chainId}:${walletAddress}`
	}

	public async newSession(sessionData: AbstractSessionData): Promise<Session<SIWESessionData>> {
		const { topic, address, timestamp, duration, publicKey } = sessionData

		const nonce = siwe.generateNonce()

		const issuedAt = new Date(timestamp).toISOString()

		const { chainId, address: walletAddress } = parseAddress(address)

		const domain = this.target.getDomain()

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			address: walletAddress,
			chainId: chainId,
			domain: domain,
			uri: publicKey,
			nonce: nonce,
			issuedAt: issuedAt,
			expirationTime: null,
			resources: [`canvas://${topic}`],
		}

		if (duration !== null) {
			siweMessage.expirationTime = new Date(timestamp + duration).toISOString()
		}

		const signature = await this.#signer.signMessage(prepareSIWEMessage(siweMessage))

		return {
			type: "session",
			address: address,
			publicKey: publicKey,
			authorizationData: { signature: getBytes(signature), domain, nonce },
			duration: duration,
			timestamp: timestamp,
			blockhash: null,
		}
	}

	public verifySession(topic: string, session: Session<SIWESessionData>) {
		const { publicKey, address, authorizationData, timestamp, duration } = session

		assert(validateSIWESessionData(authorizationData), "invalid session")
		const { chainId, address: walletAddress } = parseAddress(address)

		const siweMessage: SIWEMessage = {
			version: SIWEMessageVersion,
			domain: authorizationData.domain,
			nonce: authorizationData.nonce,
			chainId: chainId,
			address: walletAddress,
			uri: publicKey,
			issuedAt: new Date(timestamp).toISOString(),
			expirationTime: duration === null ? null : new Date(timestamp + duration).toISOString(),
			resources: [`canvas://${topic}`],
		}

		const recoveredAddress = verifyMessage(prepareSIWEMessage(siweMessage), hexlify(authorizationData.signature))
		assert(recoveredAddress === walletAddress, "invalid SIWE signature")
	}
}
