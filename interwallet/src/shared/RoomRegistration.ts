import { bytesToHex, hexToBytes } from "viem/utils"
import * as Messages from "./messages.js"
import { blake3 } from "@noble/hashes/blake3"
import { assert } from "./utils.js"
import { PublicUserRegistration } from "./PublicUserRegistration.js"
import { base58btc } from "multiformats/bases/base58"

export const getRoomId = (key: Uint8Array) => base58btc.baseEncode(key)

export class RoomRegistration {
	readonly id: string
	readonly creatorAddress: `0x${string}`
	readonly members: PublicUserRegistration[]

	constructor(creatorAddress: `0x${string}`, members: PublicUserRegistration[]) {
		this.creatorAddress = creatorAddress
		this.members = members

		const hash = blake3.create({ dkLen: 16 })
		for (const member of this.members) {
			assert(member.address, "missing member.address")
			hash.update(hexToBytes(member.address))
		}

		this.id = getRoomId(hash.digest())
	}

	getCreator(): PublicUserRegistration | null {
		let creator: PublicUserRegistration | null = null
		for (const member of this.members) {
			if (member.address == this.creatorAddress) {
				creator = member
			}
		}
		return creator
	}

	async validate() {
		for (const member of this.members) {
			await member.validate()
		}

		const creator = this.getCreator()
		assert(creator !== null, "room creator must be a member of the room")

		// TODO: validate the creator's address against its key bundle
	}

	static decode(value: Uint8Array): RoomRegistration {
		const { creator, members } = Messages.RoomRegistration.decode(value)
		return new RoomRegistration(
			bytesToHex(creator),
			members.map((member) => PublicUserRegistration.decode(Messages.SignedUserRegistration.encode(member)))
		)
	}

	static encode({ creatorAddress, members }: RoomRegistration): Uint8Array {
		return Messages.RoomRegistration.encode({
			creator: hexToBytes(creatorAddress),
			members: members.map((member) => {
				return {
					address: hexToBytes(member.address),
					keyBundle: {
						encryptionPublicKey: hexToBytes(member.keyBundle.encryptionPublicKey),
						signingPublicKey: hexToBytes(member.keyBundle.signingPublicKey),
					},
					signature: hexToBytes(member.keyBundleSignature),
				}
			}),
		})
	}
}
