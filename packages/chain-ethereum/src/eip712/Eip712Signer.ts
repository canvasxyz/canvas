import { AbstractSigner, Wallet, computeAddress, getBytes, hexlify, TypedDataField, verifyTypedData } from "ethers"
import { Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { assert, DAYS } from "@canvas-js/utils"

import { AbstractSessionSigner, decodeURI } from "@canvas-js/signatures"

import { Eip712SessionData } from "./types.js"
import { Secp256k1SignatureScheme } from "./Secp256k1DelegateSigner.js"
import { validateEip712SessionData, addressPattern, parseAddress } from "./utils.js"

export class Eip712Signer extends AbstractSessionSigner<Eip712SessionData> {
	// This is the EIP-712 type actually signed by the end user to authorize a new session.
	// Like the other "session data" objects, is never saved itself, only re-constructed
	// from existing fields in the message and session objects.
	public static sessionDataTypes = {
		SessionData: [
			{ name: "topic", type: "string" },
			{ name: "sessionAddress", type: "address" },
			{ name: "duration", type: "uint64" },
			{ name: "timestamp", type: "uint64" },
			{ name: "blockhash", type: "string" },
		],
	} satisfies Record<string, TypedDataField[]>

	public readonly match = (address: string) => addressPattern.test(address)

	public readonly chainId: number
	_signer: AbstractSigner

	constructor(
		init: { signer?: AbstractSigner; chainId?: number; sessionDuration?: number } = { sessionDuration: 14 * DAYS },
	) {
		super("chain-ethereum-eip712", Secp256k1SignatureScheme, { sessionDuration: init.sessionDuration })
		this._signer = init.signer ?? Wallet.createRandom()
		this.chainId = init.chainId ?? 1
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

	public async authorize(sessionData: AbstractSessionData): Promise<Session<Eip712SessionData>> {
		const {
			topic,
			did,
			publicKey,
			context: { timestamp, duration },
		} = sessionData

		const { type, publicKey: publicKeyBytes } = decodeURI(publicKey)
		assert(type === Secp256k1SignatureScheme.type)

		const sessionAddress = computeAddress(hexlify(publicKeyBytes))

		const signature = await this._signer.signTypedData({ name: topic }, Eip712Signer.sessionDataTypes, {
			topic: topic,
			sessionAddress: sessionAddress,
			duration: duration ?? 0,
			timestamp: timestamp,
			blockhash: "",
		})

		return {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData: { signature: getBytes(signature) },
			context: duration ? { duration, timestamp } : { timestamp },
		}
	}

	public verifySession(topic: string, session: Session<Eip712SessionData>) {
		assert(validateEip712SessionData(session.authorizationData), "invalid session")
		const { address: userAddress } = parseAddress(session.did)

		const { type, publicKey } = decodeURI(session.publicKey)
		assert(type === Secp256k1SignatureScheme.type)

		const sessionAddress = computeAddress(hexlify(publicKey))

		const recoveredAddress = verifyTypedData(
			{ name: topic },
			Eip712Signer.sessionDataTypes,
			{
				topic: topic,
				sessionAddress: sessionAddress,
				duration: session.context.duration ?? 0,
				timestamp: session.context.timestamp,
				blockhash: session.context.blockhash ?? "",
			},
			hexlify(session.authorizationData.signature),
		)

		assert(userAddress === recoveredAddress, "invalid EIP-712 session data signature")
	}
}
