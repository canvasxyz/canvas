import Prando from "prando"
import * as cbor from "@ipld/dag-cbor"
import { ed25519 as ed25519curve } from "@noble/curves/ed25519"

import type { Session, AbstractSessionData, DidIdentifier } from "@canvas-js/interfaces"
import { AbstractSessionSigner, ed25519, encodeURI, decodeURI } from "@canvas-js/signatures"
import { assert } from "@canvas-js/utils"

const randomBytes = (prng: Prando.default, length: number) => {
	const result = new Uint8Array(length)
	for (let i = 0; i < length; i++) result[i] = prng.nextInt(0, 255)
	return result
}

export class PRNGSigner extends AbstractSessionSigner<{ signature: Uint8Array }> {
	public static addressPattern = /^did:key:[a-zA-Z0-9]+$/
	public readonly match = (address: string) => PRNGSigner.addressPattern.test(address)

	public readonly key: string
	public readonly privateKey: Uint8Array
	public readonly publicKey: Uint8Array
	public readonly did: string

	public constructor(seed: number | string = 0) {
		const prng = new Prando.default(seed)
		super("prng", {
			type: ed25519.type,
			codecs: ed25519.codecs,
			verify: ed25519.verify,
			create: (init) => ed25519.create(init ?? { type: ed25519.type, privateKey: randomBytes(prng, 32) }),
		})
		this.privateKey = randomBytes(prng, 32)
		this.publicKey = ed25519curve.getPublicKey(this.privateKey)
		this.did = encodeURI("ed25519", this.publicKey)
		this.key = "prng"
	}

	public getCurrentTimestamp(): number {
		return 0
	}

	public async getDid(): Promise<DidIdentifier> {
		return this.did as DidIdentifier
	}

	public getDidParts(): number {
		return 3
	}

	public getAddressFromDid(did: DidIdentifier) {
		return did.split(":").pop()!
	}

	public async authorize(sessionData: AbstractSessionData): Promise<Session<{ signature: Uint8Array }>> {
		const {
			topic,
			did,
			context: { timestamp, duration },
			publicKey,
		} = sessionData

		assert(duration === null)

		const data = cbor.encode({ topic, timestamp, did, publicKey })
		const signature = ed25519curve.sign(data, this.privateKey)

		return {
			type: "session",
			did: did,
			publicKey: publicKey,
			authorizationData: { signature },
			context: { timestamp },
		}
	}

	public verifySession(topic: string, session: Session<{ signature: Uint8Array }>) {
		const {
			publicKey,
			did,
			authorizationData: { signature },
			context: { timestamp, duration },
		} = session

		const key = decodeURI(publicKey)
		const data = cbor.encode({ topic, timestamp, did, publicKey })
		ed25519curve.verify(signature, data, key.publicKey)
	}
}
