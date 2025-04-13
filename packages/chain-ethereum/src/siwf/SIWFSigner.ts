import { verifyMessage, hexlify, getBytes } from "ethers"
import * as siwe from "siwe"
import * as json from "@ipld/dag-json"

import type {
	Action,
	Session,
	Snapshot,
	AbstractSessionData,
	DidIdentifier,
	Signer,
	MessageType,
} from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519 } from "@canvas-js/signatures"
import { assert, DAYS } from "@canvas-js/utils"

import type { SIWFSessionData, SIWFMessage } from "./types.js"
import { validateSIWFSessionData as validateSIWFSessionDataType, parseAddress, addressPattern } from "./utils.js"

export interface SIWFSignerInit {
	sessionDuration?: number
	custodyAddress?: string // optional, but required for a signer to create messages
	privateKey?: string // optional, but required for a signer to create messages
}

/**
 * Session signer supporting Sign in with Farcaster.
 *
 * This is a prototype/alpha release that uses requestId/nonce to embed the Canvas signature
 * inside the SIWF login. Users should be aware that this is an *implicit* authorization,
 * and the user has never been explicitly asked to authorize the external Canvas application.
 *
 * Applications using this signer may wish to specify a (grow-only) whitelist of valid domains.
 *
 * Instead of calling newSession to start a session, use `SIWFSigner.newSIWFRequestId(topic)`
 * to get a requestId, pass it to Farcaster AuthKit, and call newSession() with it.
 *
 * Or inside a frame, use `SIWFSigner.newSIWFNonce(topic)` to get a nonce, request a
 * SIWF sign-in from the containing application, and call newSession() with it.
 */
export class SIWFSigner extends AbstractSessionSigner<SIWFSessionData> {
	public readonly match = (address: string) => addressPattern.test(address)

	public readonly key: string
	public readonly chainId: number
	public readonly custodyAddress: string | undefined
	public readonly privateKey: string | undefined

	public constructor({ sessionDuration, privateKey, ...init }: SIWFSignerInit = {}) {
		super("chain-ethereum-farcaster", ed25519, { sessionDuration: sessionDuration ?? 14 * DAYS })

		this.chainId = 10
		this.key = `chain-ethereum-siwf`
		this.custodyAddress = init.custodyAddress
		this.privateKey = privateKey

		if (privateKey) {
			if (privateKey.length !== 64 || !privateKey.match(/^[0-9a-f]+$/i)) {
				throw new Error("SIWFSigner privateKey must be 32 bytes (64 hex chars)")
			}
			this.target.set(`canvas:signers/chain-ethereum-farcaster/seed`, privateKey)
		}
	}

	public isReadOnly() {
		if (!this.custodyAddress || !this.privateKey) return true
		return false
	}

	public async getDid(): Promise<DidIdentifier> {
		assert(this.custodyAddress && this.privateKey, "SIWFSigner initializd without a custody address")
		if (!this.custodyAddress) throw new Error("not initialized")
		return `did:pkh:farcaster:${this.custodyAddress}`
	}

	public getDidParts(): number {
		return 4
	}

	public getAddressFromDid(did: DidIdentifier) {
		const { address } = parseAddress(did)
		return address
	}

	public async authorize(sessionData: AbstractSessionData): Promise<Session<SIWFSessionData>> {
		throw new Error("use siwfSigner.newSIWFSession() instead")
	}

	public async newSIWFSession(
		topic: string,
		authorizationData: SIWFSessionData,
		timestamp: number,
		privateKey: Uint8Array,
	): Promise<{ payload: Session<SIWFSessionData>; signer: Signer<MessageType<SIWFSessionData>> }> {
		const signer = this.scheme.create({ type: ed25519.type, privateKey })
		const did = await this.getDid()

		const sessionData = {
			topic,
			did,
			publicKey: signer.publicKey,
			context: {
				timestamp: timestamp,
				duration: this.sessionDuration,
			},
		}
		const session = authorizationData
			? await this.getSessionFromAuthorizationData(sessionData, authorizationData)
			: await this.authorize(sessionData)

		const key = `canvas/${topic}/${did}`
		this.target.set(key, json.stringify({ session, ...signer.export() }))

		return { payload: session, signer }
	}

	public restoreSIWFSession(
		topic: string,
	): { payload: Session<SIWFSessionData>; signer: Signer<MessageType<SIWFSessionData>> } | null {
		const keyPrefix = `canvas/${topic}/`
		const values = this.target.getAll(keyPrefix)
		for (const value of values) {
			try {
				const { session, type, privateKey } = json.parse<{
					type: string
					privateKey: Uint8Array
					session: Session<SIWFSessionData>
				}>(value)
				const signer = ed25519.create({ type, privateKey })
				return { payload: session, signer }
			} catch (err) {
				console.error(err)
			}
		}
		return null
	}

	public static newSIWFRequestId(topic: string): { requestId: string; privateKey: Uint8Array } {
		const signer = ed25519.create()
		const canvasDelegateSignerAddress = signer.publicKey
		return {
			requestId: `authorize:${topic}:${canvasDelegateSignerAddress}`,
			...signer.export(),
		}
	}

	public static getSIWFRequestId(topic: string, privateKey: string): string {
		const signer = ed25519.create({ type: ed25519.type, privateKey: getBytes(privateKey) })
		const canvasDelegateSignerAddress = signer.publicKey
		return `authorize:${topic}:${canvasDelegateSignerAddress}`
	}

	public static newSIWFRequestNonce(topic: string): { nonce: string; privateKey: Uint8Array } {
		const signer = ed25519.create()
		const canvasDelegateSignerAddress = signer.publicKey
		return {
			nonce: Buffer.from(`authorize:${topic}:${canvasDelegateSignerAddress}`).toString("base64"),
			...signer.export(),
		}
	}

	/**
	 * Parse an AuthorizationData, topic, and Farcaster custody address, from a SIWF message.
	 */
	public static parseSIWFMessage(
		siwfMessage: string,
		siwfSignature: string,
	): { authorizationData: SIWFSessionData; custodyAddress: string; topic: string } {
		const siweMessage = new siwe.SiweMessage(siwfMessage)

		// parse fid
		assert(siweMessage.resources && siweMessage.resources.length > 0, "could not get fid from farcaster login message")
		const fidResource = siweMessage.resources[0]
		const fid = fidResource.split("/").pop()
		assert(fid !== undefined && !isNaN(parseInt(fid, 10)), "invalid fid from farcaster login message")

		if (siweMessage.requestId) {
			// client based SIWF message - parse requestId
			const [prefix, topic] = siweMessage.requestId.split(":", 2)
			const canvasDelegateAddress = siweMessage.requestId.slice(
				siweMessage.requestId.indexOf(":", siweMessage.requestId.indexOf(":") + 1) + 1,
			)
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

			return {
				authorizationData,
				topic,
				custodyAddress: siweMessage.address,
			}
		} else {
			// frame based SIWF message - parse nonce
			const decodedNonce = Buffer.from(siweMessage.nonce, "base64").toString()
			const [prefix, topic, canvasDelegateAddress] = decodedNonce.split(":")
			assert(prefix === "authorize", "invalid nonce from farcaster login message")
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
				frame: true,
			}

			return {
				authorizationData,
				topic,
				custodyAddress: siweMessage.address,
			}
		}
	}

	public verifySession(topic: string, session: Session<SIWFSessionData>) {
		const {
			publicKey,
			did,
			authorizationData,
			context: { timestamp },
		} = session

		assert(validateSIWFSessionDataType(authorizationData), "invalid session")
		const { address: canvasDelegateAddress } = parseAddress(did)

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

		if (authorizationData.frame) {
			const nonce = Buffer.from(`authorize:${topic}:${publicKey}`).toString("base64")
			assert(authorizationData.siweNonce === nonce, "invalid SIWF signature for this topic and session publicKey")

			const message = new siwe.SiweMessage({
				domain: authorizationData.siweDomain,
				address: authorizationData.custodyAddress,
				uri: authorizationData.siweUri,
				statement: "Farcaster Auth",
				version: "1",
				chainId: 10,
				nonce: authorizationData.siweNonce,
				issuedAt: authorizationData.siweIssuedAt,
				expirationTime: authorizationData.siweExpirationTime ?? undefined,
				notBefore: authorizationData.siweNotBefore ?? undefined,
				resources: [`farcaster://fid/${authorizationData.fid}`],
			}).prepareMessage()

			const recoveredAddress = verifyMessage(message, hexlify(authorizationData.signature))
			assert(recoveredAddress === authorizationData.custodyAddress, "invalid SIWF signature")
		} else {
			const requestId = `authorize:${topic}:${publicKey}`

			const message = new siwe.SiweMessage({
				domain: authorizationData.siweDomain,
				address: authorizationData.custodyAddress,
				uri: authorizationData.siweUri,
				statement: "Farcaster Auth",
				version: "1",
				chainId: 10,
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
}
