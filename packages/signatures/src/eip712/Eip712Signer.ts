import { computeAddress, hexlify, TypedDataField, verifyTypedData } from "ethers"
import { Session } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

import { AbstractSessionData, AbstractSessionSigner } from "../AbstractSessionSigner.js"

import { Secp256k1Signer } from "./Secp256k1Signer.js"
import { Eip712AuthorizationData } from "./types.js"
import { eip155AddressPattern, parseEip155Address } from "./utils.js"
import { decodeURI } from "../utils.js"

export class Eip712Signer extends AbstractSessionSigner<Eip712AuthorizationData> {
	// This is the EIP-712 type actually signed by the end user to authorize a new session.
	// This is never saved as its own object, only re-constructed from existing fields in
	// the message and session objects.
	public static sessionDataTypes = {
		SessionData: [
			{ name: "topic", type: "string" },
			{ name: "sessionAddress", type: "address" },
			{ name: "duration", type: "uint64" },
			{ name: "timestamp", type: "uint64" },
			{ name: "blockhash", type: "string" },
		],
	} satisfies Record<string, TypedDataField[]>

	constructor() {
		super("chain-ethereum-eip712", { createSigner: (init) => new Secp256k1Signer(init) })
	}

	public readonly match = (address: string) => eip155AddressPattern.test(address)
	public readonly verify = Secp256k1Signer.verify

	protected async getAddress(): Promise<string> {
		throw new Error("not implemented")
	}

	protected async newSession(data: AbstractSessionData): Promise<Session<Eip712AuthorizationData>> {
		throw new Error("not implemented")
	}

	public verifySession(topic: string, session: Session<Eip712AuthorizationData>) {
		const { address } = parseEip155Address(session.address)
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

		assert(address === recoveredAddress, "invalid EIP-712 session data signature")
	}
}
