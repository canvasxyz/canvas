import { bytesToHex, getAddress, hexToBytes } from "viem"

import { decode, encode } from "microcbor"
import { base58btc } from "multiformats/bases/base58"
import nacl from "tweetnacl"

import * as Messages from "./messages.js"
import { PrivateUserRegistration, Room, RoomEvent } from "./types"
import { assert } from "./utils.js"
import { equals } from "uint8arrays"

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

		// TODO: validate all of the key bundles

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

	static encryptMessageForRoom(room: Room, message: string, user: PrivateUserRegistration): EncryptedEvent {
		const event = {
			type: "message",
			detail: { content: message, sender: user.address, timestamp: Date.now() },
		}

		const otherRoomMembers = room.members.filter(({ address }) => user.address !== address)
		assert(otherRoomMembers.length > 0, "room has no other members")

		const encodedEvent = encode(event)

		return new EncryptedEvent(
			base58btc.baseDecode(room.id),
			hexToBytes(user.address),
			hexToBytes(user.keyBundle.encryptionPublicKey),
			otherRoomMembers.map((otherRoomMember) => {
				const publicKey = hexToBytes(otherRoomMember.keyBundle.encryptionPublicKey)
				const nonce = nacl.randomBytes(nacl.box.nonceLength)
				const ciphertext = nacl.box(encodedEvent, nonce, publicKey, hexToBytes(user.encryptionPrivateKey))

				return {
					publicKey,
					ciphertext,
					nonce,
				}
			})
		)
	}

	static decrypt(encryptedEvent: EncryptedEvent, user: PrivateUserRegistration): RoomEvent {
		let messageToDecrypt: Messages.EncryptedPayload
		let publicKey: Uint8Array

		if (equals(encryptedEvent.senderAddress, hexToBytes(user.address))) {
			// this user is the sender
			// decrypt an arbitrary message, so choose the first one
			messageToDecrypt = encryptedEvent.recipients[0]
			publicKey = messageToDecrypt.publicKey
		} else {
			// otherwise this user is one of the recipients
			const retrievedMessageToDecrypt = encryptedEvent.recipients.find(({ publicKey }) =>
				equals(publicKey, hexToBytes(user.keyBundle.encryptionPublicKey))
			)
			assert(retrievedMessageToDecrypt !== undefined, "failed to find encrypted message for this user")
			messageToDecrypt = retrievedMessageToDecrypt
			publicKey = encryptedEvent.senderPublicKey
		}

		const decryptedEvent = nacl.box.open(
			messageToDecrypt.ciphertext,
			messageToDecrypt.nonce,
			publicKey,
			hexToBytes(user.encryptionPrivateKey)
		)
		assert(decryptedEvent !== null, "failed to decrypt room event")

		return decode(decryptedEvent) as RoomEvent
	}
}
