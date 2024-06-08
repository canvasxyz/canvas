import { Wallet, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"

import type { Awaitable, Session, AbstractSessionData } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
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
	getAddress(): Awaitable<string>
	signMessage(message: string): Awaitable<string>
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

	_signer: AbstractSigner

	public constructor({ sessionDuration, ...init }: SIWESignerInit = {}) {
		super("chain-ethereum", ed25519, { sessionDuration })

		this._signer = init.signer ?? Wallet.createRandom()
		this.chainId = init.chainId ?? 1
		this.key = `SIWESigner-${init.signer ? "signer" : "burner"}`
	}

	public async getAddress(): Promise<string> {
		const walletAddress = await this._signer.getAddress()
		return `eip155:${this.chainId}:${walletAddress}`
	}

	public async authorize(sessionData: AbstractSessionData): Promise<Session<SIWESessionData>> {
		const {
			topic,
			address,
			context: { timestamp, duration },
			publicKey,
		} = sessionData

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

		const signature = await this._signer.signMessage(prepareSIWEMessage(siweMessage))

		return {
			type: "session",
			address: address,
			publicKey: publicKey,
			authorizationData: { signature: getBytes(signature), domain, nonce },
			context: duration ? { duration, timestamp } : { timestamp },
		}
	}

	public verifySession(topic: string, session: Session<SIWESessionData>) {
		const {
			publicKey,
			address,
			authorizationData,
			context: { timestamp, duration },
		} = session

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
			expirationTime: duration === undefined ? null : new Date(timestamp + duration).toISOString(),
			resources: [`canvas://${topic}`],
		}

		const recoveredAddress = verifyMessage(prepareSIWEMessage(siweMessage), hexlify(authorizationData.signature))
		assert(recoveredAddress === walletAddress, "invalid SIWE signature")
	}
}
