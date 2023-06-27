import nacl from "tweetnacl"
import { hexToBytes } from "viem"

import { EncryptedEvent } from "./EncryptedEvent"
import * as Messages from "./messages.js"
import { getRoomId } from "./RoomRegistration.js"
import { PrivateUserRegistration, Room, RoomEvent } from "./types"
import { assert } from "./utils.js"

export class SignedEncryptedEvent {
	readonly signature: Uint8Array
	readonly encryptedEvent: EncryptedEvent

	constructor(signature: Uint8Array, encryptedEvent: EncryptedEvent) {
		this.signature = signature
		this.encryptedEvent = encryptedEvent
	}

	async validate(room: Room) {
		assert(getRoomId(this.encryptedEvent.roomId) === room.id, "event is for a different room")

		const signedData = Messages.EncryptedEvent.encode(this.encryptedEvent)

		await this.encryptedEvent.validate(room)

		assert(
			nacl.sign.detached.verify(signedData, this.signature, this.encryptedEvent.senderPublicKey),
			"invalid event signature"
		)
	}

	static decode(value: Uint8Array): SignedEncryptedEvent {
		const { signature, data: signedData } = Messages.SignedData.decode(value)
		const encryptedEvent = EncryptedEvent.decode(signedData)
		return new SignedEncryptedEvent(signature, encryptedEvent)
	}

	static encode(event: SignedEncryptedEvent): Uint8Array {
		return Messages.SignedData.encode({
			signature: event.signature,
			data: Messages.EncryptedEvent.encode(event.encryptedEvent),
		})
	}

	static encryptAndSignMessageForRoom(
		room: Room,
		message: string,
		user: PrivateUserRegistration
	): SignedEncryptedEvent {
		const encryptedEvent = EncryptedEvent.encryptMessageForRoom(room, message, user)

		const encryptedData = EncryptedEvent.encode(encryptedEvent)
		const signature = nacl.sign.detached(encryptedData, hexToBytes(user.signingPrivateKey))

		return new SignedEncryptedEvent(signature, encryptedEvent)
	}

	static decrypt(event: SignedEncryptedEvent, user: PrivateUserRegistration): RoomEvent {
		return EncryptedEvent.decrypt(event.encryptedEvent, user) as RoomEvent
	}
}
