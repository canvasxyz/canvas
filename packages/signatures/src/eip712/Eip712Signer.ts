import { AbstractSigner, Wallet, computeAddress, getBytes, hexlify, TypedDataField, verifyTypedData } from "ethers"
import { Session } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { AbstractSessionData, AbstractSessionSigner } from "../AbstractSessionSigner.js"
import { decodeURI } from "../utils.js"

import { Secp256k1Signer } from "./Secp256k1Signer.js"
import { Eip712AuthorizationData } from "./types.js"
import { eip155AddressPattern, parseEip155Address } from "./utils.js"

export class Eip712Signer extends AbstractSessionSigner<Eip712AuthorizationData> {
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

	#signer: AbstractSigner
	public readonly chainId: number

	constructor(init: { signer?: AbstractSigner; chainId?: number } = {}) {
		super("chain-ethereum-eip712", { createSigner: (init) => new Secp256k1Signer(init) })
		this.#signer = init.signer ?? Wallet.createRandom()
		this.chainId = init.chainId ?? 1
	}

	public readonly match = (address: string) => eip155AddressPattern.test(address)
	public readonly verify = Secp256k1Signer.verify

	protected async getAddress(): Promise<string> {
		const walletAddress = await this.#signer.getAddress()
		return `eip155:${this.chainId}:${walletAddress}`
	}

	protected async newSession(sessionData: AbstractSessionData): Promise<Session<Eip712AuthorizationData>> {
		const { topic, address, publicKey, timestamp, duration } = sessionData

		const { type, publicKey: publicKeyBytes } = decodeURI(publicKey)
		assert(type === Secp256k1Signer.type)

		const sessionAddress = computeAddress(hexlify(publicKeyBytes))

		const signature = await this.#signer.signTypedData({ name: topic }, Eip712Signer.sessionDataTypes, {
			topic: topic,
			sessionAddress: sessionAddress,
			duration: duration ?? 0,
			timestamp: timestamp,
			blockhash: "",
		})

		return {
			type: "session",
			address: address,
			publicKey: publicKey,
			authorizationData: { signature: getBytes(signature) },
			duration: duration,
			timestamp: timestamp,
			blockhash: null,
		}
	}

	public verifySession(topic: string, session: Session<Eip712AuthorizationData>) {
		const { address: expectedAddress } = parseEip155Address(session.address)

		const { type, publicKey } = decodeURI(session.publicKey)
		assert(type === Secp256k1Signer.type)

		const sessionAddress = computeAddress(hexlify(publicKey))

		const recoveredAddress = verifyTypedData(
			{ name: topic },
			Eip712Signer.sessionDataTypes,
			{
				topic: topic,
				sessionAddress: sessionAddress,
				duration: session.duration ?? 0,
				timestamp: session.timestamp,
				blockhash: session.blockhash ?? "",
			},
			hexlify(session.authorizationData.signature),
		)

		assert(expectedAddress === recoveredAddress, "invalid EIP-712 session data signature")
	}
}
