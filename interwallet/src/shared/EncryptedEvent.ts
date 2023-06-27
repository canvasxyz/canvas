import { bytesToHex, getAddress } from "viem"

import * as Messages from "./messages.js"
import { Room } from "./types"
import { assert } from "."

type EncryptedPayload = {
	publicKey: Uint8Array
	ciphertext: Uint8Array
	nonce: Uint8Array
}

export class EncryptedEvent {
	readonly roomId: Uint8Array
	readonly senderAddress: Uint8Array
	readonly senderPublicKey: Uint8Array
	readonly recipients: EncryptedPayload[]

	constructor(
		roomId: Uint8Array,
		senderAddress: Uint8Array,
		senderPublicKey: Uint8Array,
		recipients: EncryptedPayload[]
	) {
		this.roomId = roomId
		this.senderAddress = senderAddress
		this.senderPublicKey = senderPublicKey
		this.recipients = recipients
	}

	async validate(room: Room) {
		const senderAddress = getAddress(bytesToHex(this.senderAddress))
		const sender = room.members.find((member) => member.address === senderAddress)
		assert(sender !== undefined, "sender is not a member of the room")

		// validate all of the key bundles

		for (const eachRecipient of this.recipients) {
			if (eachRecipient === undefined) {
				continue
			}
			const recipientPublicKey = bytesToHex(eachRecipient.publicKey)
			const recipient = room.members.find((member) => member.keyBundle.encryptionPublicKey === recipientPublicKey)
			assert(recipient !== undefined, "recipient is not a member of the room")
		}
	}

	static decode(value: Uint8Array): EncryptedEvent {
		const decodedEvent = Messages.EncryptedEvent.decode(value)

		return new EncryptedEvent(
			decodedEvent.roomId,
			decodedEvent.senderAddress,
			decodedEvent.senderPublicKey,
			decodedEvent.recipients
		)
	}
	static encode(event: EncryptedEvent): Uint8Array {
		return Messages.EncryptedEvent.encode({
			roomId: event.roomId,
			senderAddress: event.senderAddress,
			senderPublicKey: event.senderPublicKey,
			recipients: event.recipients,
		})
	}
}
