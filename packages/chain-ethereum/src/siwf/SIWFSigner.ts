import { Wallet, verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"

import type { Awaitable, Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
import { assert, DAYS } from "@canvas-js/utils"

import type { SIWFSessionData, SIWFMessage } from "./types.js"
import { validateSIWFSessionData as validateSIWFSessionDataType, parseAddress, addressPattern } from "./utils.js"

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
		throw new Error("signer.newSession() must be called with a provided AuthorizationData from farcaster login")
	}

	public async getSIWFRequestId(topic: string): Promise<string> {
		const canvasDelegateSignerAddress = await this._signer.getAddress()
		return `authorize:${topic}:${canvasDelegateSignerAddress}`
	}

	/**
	 * Parse an AuthorizationData, topic, and its action signer address, from a SIWF message.
	 */
	public parseSIWFMessage(siwfMessage: string, siwfSignature: string): [SIWFSessionData, string, string] {
		const siweMessage = new siwe.SiweMessage(siwfMessage)

		// parse fid, requestId
		assert(siweMessage.resources && siweMessage.resources.length > 0, "could not get fid from farcaster login message")
		const fidResource = siweMessage.resources[0]
		const fid = fidResource.split("/").pop()
		assert(fid !== undefined && !isNaN(parseInt(fid, 10)), "invalid fid from farcaster login message")

		assert(
			siweMessage.requestId !== undefined,
			"farcaster login must include a valid requestId generated by SIWFSigner",
		)
		const [prefix, topic, canvasDelegateAddress] = siweMessage.requestId.split(":")
		assert(prefix === "authorize", "invalid requestId from farcaster login message")
		assert(siweMessage.issuedAt !== undefined, "invalid issuedAt from farcaster login message")

		const authorizationData: SIWFSessionData = {
			custodyAddress: siweMessage.address,
			fid,
			signature: getBytes(siwfSignature),
			siweUri: siweMessage.uri,
			siweDomain: siweMessage.domain,
			siweNonce: siweMessage.nonce,
			siweVersion: siweMessage.version,
			siweChainId: siweMessage.chainId,
			siweIssuedAt: siweMessage.issuedAt,
			siweExpirationTime: siweMessage.expirationTime ?? null,
			siweNotBefore: siweMessage.notBefore ?? null,
		}

		return [authorizationData, topic, canvasDelegateAddress]
	}

	public verifySession(topic: string, session: Session<SIWFSessionData>) {
		const {
			publicKey,
			did,
			authorizationData,
			context: { timestamp, duration },
		} = session

		assert(validateSIWFSessionDataType(authorizationData), "invalid session")
		const { chainId, address: canvasDelegateAddress } = parseAddress(did)

		// Validate SIWF timestamps, which depend on `timestamp` and wallet-specific checks
		// that ensure expirationTime and notBefore are around issuedAt.
		const SIXTY_MINUTES = 60 * 60 * 1000
		const issuedAtTimestamp = new Date(authorizationData.siweIssuedAt).valueOf()
		assert(issuedAtTimestamp === new Date(timestamp).valueOf(), "issuedAt should match timestamp")

		if (authorizationData.siweExpirationTime) {
			const expirationTime = new Date(authorizationData.siweExpirationTime)
			assert(expirationTime >= new Date(timestamp), "expirationTime cannot be before timestamp")
			assert(expirationTime < new Date(timestamp + SIXTY_MINUTES), "expirationTime is too far after timestamp")
		}
		if (authorizationData.siweNotBefore) {
			const notBefore = new Date(authorizationData.siweNotBefore)
			assert(notBefore <= new Date(timestamp), "notBefore cannot be after timestamp")
			assert(notBefore > new Date(timestamp - SIXTY_MINUTES), "notBefore too far before timestamp")
		}

		const requestId = `authorize:${topic}:${canvasDelegateAddress}`

		const message = new siwe.SiweMessage({
			domain: authorizationData.siweDomain,
			address: authorizationData.custodyAddress,
			uri: authorizationData.siweUri,
			statement: "Farcaster Auth",
			version: "1",
			chainId: chainId,
			nonce: authorizationData.siweNonce,
			issuedAt: authorizationData.siweIssuedAt,
			expirationTime: authorizationData.siweExpirationTime ?? undefined,
			notBefore: authorizationData.siweNotBefore ?? undefined,
			requestId: requestId,
			resources: [`farcaster://fid/${authorizationData.fid}`],
		}).prepareMessage()

		const recoveredAddress = verifyMessage(message, hexlify(authorizationData.signature))
		assert(recoveredAddress === authorizationData.custodyAddress, "invalid SIWF signature")
	}
}
