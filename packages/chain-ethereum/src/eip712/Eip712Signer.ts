import { AbstractSigner, Wallet, computeAddress, getBytes, hexlify, TypedDataField, verifyTypedData } from "ethers"
import { Session, AbstractSessionData } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { AbstractSessionSigner, decodeURI } from "@canvas-js/signatures"

import { Eip712SessionData } from "./types.js"
import { Secp256k1DelegateSigner } from "./Secp256k1DelegateSigner.js"
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

	public readonly codecs = [Secp256k1DelegateSigner.eip712ActionCodec, Secp256k1DelegateSigner.eip712SessionCodec]
	public readonly match = (address: string) => addressPattern.test(address)
	public readonly verify = Secp256k1DelegateSigner.verify

	public readonly chainId: number
	#signer: AbstractSigner

	constructor(init: { signer?: AbstractSigner; chainId?: number } = {}) {
		super("chain-ethereum-eip712", { createSigner: (init) => new Secp256k1DelegateSigner(init) })
		this.#signer = init.signer ?? Wallet.createRandom()
		this.chainId = init.chainId ?? 1
	}

	// TODO: should be getUserAddress() or getWalletAddress()
	public async getAddress(): Promise<string> {
		const walletAddress = await this.#signer.getAddress()
		return `eip155:${this.chainId}:${walletAddress}`
	}

	public async newSession(sessionData: AbstractSessionData): Promise<Session<Eip712SessionData>> {
		const { topic, address, publicKey, timestamp, duration } = sessionData

		const { type, publicKey: publicKeyBytes } = decodeURI(publicKey)
		assert(type === Secp256k1DelegateSigner.type)

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

	public verifySession(topic: string, session: Session<Eip712SessionData>) {
		assert(validateEip712SessionData(session.authorizationData), "invalid session")
		const { address: userAddress } = parseAddress(session.address)

		const { type, publicKey } = decodeURI(session.publicKey)
		assert(type === Secp256k1DelegateSigner.type)

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

		assert(userAddress === recoveredAddress, "invalid EIP-712 session data signature")
	}
}
