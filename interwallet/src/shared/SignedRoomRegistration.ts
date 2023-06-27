import nacl from "tweetnacl"
import { hexToBytes } from "viem"

import * as Messages from "./messages.js"
import { RoomRegistration, getRoomId } from "./RoomRegistration"
import { assert } from "./utils"
import { PrivateUserRegistration } from "./types.js"

export class SignedRoomRegistration {
	public readonly roomRegistration: RoomRegistration
	public readonly signature: Uint8Array

	constructor(roomRegistration: RoomRegistration, signature: Uint8Array) {
		this.roomRegistration = roomRegistration
		this.signature = signature
	}

	getRoomDbEntry() {
		return {
			id: this.roomRegistration.id,
			creator: this.roomRegistration.creatorAddress,
			members: this.roomRegistration.members,
		}
	}

	async validate(key: Uint8Array) {
		await this.roomRegistration.validate()
		const creator = this.roomRegistration.getCreator()
		assert(creator !== null, "room creator must be a member of the room")

		const signedData = RoomRegistration.encode(this.roomRegistration)
		assert(
			nacl.sign.detached.verify(signedData, this.signature, hexToBytes(creator.keyBundle.signingPublicKey)),
			"invalid room registration signature"
		)

		assert(getRoomId(key) == this.roomRegistration.id, "invalid room registration id")
	}

	static decode(value: Uint8Array): SignedRoomRegistration {
		const { signature, data: signedData } = Messages.SignedData.decode(value)
		const roomRegistration = RoomRegistration.decode(signedData)
		return new SignedRoomRegistration(roomRegistration, signature)
	}

	static sign(roomRegistration: RoomRegistration, user: PrivateUserRegistration): SignedRoomRegistration {
		assert(roomRegistration.creatorAddress === user.address, "room creator must be the current user")
		assert(
			roomRegistration.members.find(({ address }) => address === user.address),
			"members did not include the current user"
		)

		const signature = nacl.sign.detached(RoomRegistration.encode(roomRegistration), hexToBytes(user.signingPrivateKey))
		return new SignedRoomRegistration(roomRegistration, signature)
	}

	static encode({ signature, roomRegistration }: SignedRoomRegistration): Uint8Array {
		return Messages.SignedData.encode({
			signature,
			data: RoomRegistration.encode(roomRegistration),
		})
	}
}
