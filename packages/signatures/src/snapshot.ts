import type { Message, Signature, SignatureScheme, Signer } from "@canvas-js/interfaces"
import { assert } from "@canvas-js/utils"

const codecs = { snapshot: "canvas-snapshot" }

/**
 * SnapshotSigner returns an empty signature, and supports the following codecs:
 * - snapshot
 */
export class SnapshotSigner<Payload extends { type: string }> implements Signer<Payload> {
	public readonly publicKey: string = ""
	public readonly scheme: SignatureScheme<any> = SnapshotSignatureScheme

	public constructor() {}

	public sign(message: Message<Payload>): Signature {
		assert(message.payload.type === "snapshot", "SnapshotSigner only supports messages of type 'snapshot'")
		assert(message.clock === 0)
		assert(message.parents.length === 0)
		return {
			codec: "canvas-snapshot",
			publicKey: "",
			signature: new Uint8Array(0),
		}
	}

	public export(): { type: string; privateKey: Uint8Array } {
		throw new Error("unimplemented")
	}
}

export const SnapshotSignatureScheme = {
	type: "canvas-snapshot",
	codecs: [codecs.snapshot],

	verify: (signature: Signature, message: Message<any>) => {
		assert(signature.publicKey === "")
		assert(signature.signature instanceof Uint8Array && signature.signature.length === 0)
		assert(message.clock === 0)
		assert(message.parents.length === 0)
		assert("type" in message.payload && message.payload.type === "snapshot")
	},

	create: <Payload extends { type: string }>() => new SnapshotSigner<Payload>(),
} satisfies SignatureScheme<any>
