import { Wallet, verifyMessage, hexlify } from "ethers"
import * as siwe from "siwe"

import type { Awaitable, Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
import { assert, DAYS } from "@canvas-js/utils"

import type { SIWFSessionData, SIWFMessage } from "./types.js"
import { validateSIWFSessionData, prepareSIWFMessage, parseAddress, addressPattern } from "./utils.js"

type AbstractSigner = {
	getAddress(): Awaitable<string>
	signMessage(message: string): Awaitable<string>
}

export interface SIWFSignerInit {
	chainId?: number
	signer?: AbstractSigner
	sessionDuration?: number
}

export class SIWFSigner extends AbstractSessionSigner<SIWFSessionData> {
	public readonly match = (address: string) => addressPattern.test(address)

	public readonly key: string
	public readonly chainId: number

	_signer: AbstractSigner

	public constructor({ sessionDuration, ...init }: SIWFSignerInit = { sessionDuration: 14 * DAYS }) {
		super("chain-ethereum", ed25519, { sessionDuration })

		this._signer = init.signer ?? new Wallet(this.privkeySeed) // Wallet.createRandom()
		this.chainId = init.chainId ?? 10
		this.key = `SIWFSigner-${init.signer ? "signer" : "burner"}`
	}

	public async getDid(): Promise<DidIdentifier> {
		const walletAddress = await this._signer.getAddress()
		return `did:pkh:eip155:${this.chainId}:${walletAddress}`
	}

	public getDidParts(): number {
		return 5
	}

	public getAddressFromDid(did: DidIdentifier) {
		const { address } = parseAddress(did)
		return address
	}

	public async authorize(sessionData: AbstractSessionData): Promise<Session<SIWFSessionData>> {
		throw new Error("unimplemented: use this.createAuthorizationData() and provide it to newSession() instead")
	}

	public async createAuthorizationData(): Promise<SIWFSessionData> {
		// TODO
		throw new Error("unimplemented")
	}

	public verifySession(topic: string, session: Session<SIWFSessionData>) {
		const {
			publicKey,
			did,
			authorizationData,
			context: { timestamp, duration },
		} = session

		assert(validateSIWFSessionData(authorizationData), "invalid session")
		const { chainId, address: walletAddress } = parseAddress(did)

		// Validate SIWF timestamps, which depend on `timestamp` and wallet-specific checks
		// that ensure expirationTime and notBefore are around issuedAt.
		const SIXTY_MINUTES = 60 * 60 * 1000

		assert(
			new Date(authorizationData.issuedAt).valueOf() === new Date(timestamp).valueOf(),
			"issuedAt should match timestamp",
		)
		assert(new Date(authorizationData.expirationTime) >= new Date(timestamp), "issuedAt cannot be before timestamp")
		assert(
			new Date(authorizationData.expirationTime) < new Date(timestamp + SIXTY_MINUTES),
			"issuedAt is too far after timestamp",
		)
		assert(new Date(authorizationData.notBefore) <= new Date(timestamp), "notBefore cannot be after timestamp")
		assert(
			new Date(authorizationData.notBefore) > new Date(timestamp - SIXTY_MINUTES),
			"notBefore too far before timestamp",
		)

		// TODO
		console.log(publicKey)
		console.log(duration)

		const siweMessage: SIWFMessage = {
			version: "1",
			domain: authorizationData.domain,
			uri: `https://${authorizationData.domain}/`,
			nonce: `${topic}`, // TODO: hash topic, hash publicKey, prefix with canvas
			chainId: chainId,
			address: authorizationData.farcasterSignerAddress,
			issuedAt: authorizationData.issuedAt,
			expirationTime: authorizationData.expirationTime,
			notBefore: authorizationData.notBefore,
			resources: [`farcaster://fid/${authorizationData.fid}`],
		}

		const message = prepareSIWFMessage(siweMessage)
		const recoveredAddress = verifyMessage(message, hexlify(authorizationData.signature))
		assert(recoveredAddress === authorizationData.farcasterSignerAddress, "invalid SIWF signature")
	}
}
