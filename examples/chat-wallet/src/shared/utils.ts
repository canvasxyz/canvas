import { getAddress, bytesToHex, hexToBytes, recoverTypedDataAddress } from "viem/utils"

import nacl from "tweetnacl"
import * as cbor from "microcbor"
import { equals } from "uint8arrays"
import { blake3 } from "@noble/hashes/blake3"

import * as Messages from "./messages.js"
import type {
	KeyBundle,
	PrivateUserRegistration,
	PublicUserRegistration,
	Room,
	RoomEvent,
	RoomRegistration,
} from "./types.js"

/**
 * export function encode(value: UserRegistration, context: { privateKey }): Uint8Array { ... }
 *
 * export function decode(bytes: Uint8Array): UserRegistration { ... }
 */

export function assert(condition: unknown, message?: string): asserts condition {
	if (condition) {
		return
	} else {
		throw new Error(message ?? "assertion error")
	}
}

export const getPublicUserRegistration = ({
	encryptionPrivateKey,
	signingPrivateKey,
	...user
}: PrivateUserRegistration): PublicUserRegistration => user

export function constructTypedKeyBundle(keyBundle: KeyBundle) {
	const types = {
		EIP712Domain: [{ name: "name", type: "string" }],
		KeyBundle: [
			{ name: "signingPublicKey", type: "bytes" },
			{ name: "encryptionPublicKey", type: "bytes" },
		],
	} as const

	return {
		types,
		primaryType: "KeyBundle" as const,
		domain: { name: "InterwalletChat" } as const,
		message: keyBundle,
	}
}

function decodeSignedData(value: Uint8Array): Messages.SignedData {
	const { data, signature, publicKey } = Messages.SignedData.decode(value)
	assert(nacl.sign.detached.verify(data, signature, publicKey), "invalid signature")
	return { data, signature, publicKey }
}

function encodeSignedData(data: Uint8Array, context: { user: PrivateUserRegistration }): Uint8Array {
	const signature = nacl.sign.detached(data, hexToBytes(context.user.signingPrivateKey))
	return Messages.SignedData.encode({
		data,
		signature,
		publicKey: hexToBytes(context.user.keyBundle.signingPublicKey),
	})
}

async function validateUserRegistration(userRegistration: PublicUserRegistration): Promise<void> {
	const typedKeyBundle = constructTypedKeyBundle(userRegistration.keyBundle)

	const address = await recoverTypedDataAddress({
		...typedKeyBundle,
		signature: userRegistration.keyBundleSignature,
	})

	assert(address === userRegistration.address, "invalid signature")
}

const serializeUser = (user: PublicUserRegistration): Messages.SignedUserRegistration => ({
	address: hexToBytes(user.address),
	signature: hexToBytes(user.keyBundleSignature),
	keyBundle: {
		signingPublicKey: hexToBytes(user.keyBundle.signingPublicKey),
		encryptionPublicKey: hexToBytes(user.keyBundle.encryptionPublicKey),
	},
})

function parseUser({ address, signature, keyBundle }: Messages.SignedUserRegistration): PublicUserRegistration {
	assert(keyBundle !== undefined, "user registration is missing key bundle")

	return {
		address: getAddress(bytesToHex(address)),
		keyBundleSignature: bytesToHex(signature),
		keyBundle: {
			signingPublicKey: bytesToHex(keyBundle.signingPublicKey),
			encryptionPublicKey: bytesToHex(keyBundle.encryptionPublicKey),
		},
	}
}

export async function decodeUserRegistration(value: Uint8Array): Promise<PublicUserRegistration> {
	const userRegistration = parseUser(Messages.SignedUserRegistration.decode(value))
	await validateUserRegistration(userRegistration)
	return userRegistration
}

export async function encodeUserRegistration(userRegistration: PublicUserRegistration): Promise<Uint8Array> {
	await validateUserRegistration(userRegistration)
	return Messages.SignedUserRegistration.encode(serializeUser(userRegistration))
}

export async function encodeRoomRegistration(
	roomRegistration: RoomRegistration,
	context: { user: PrivateUserRegistration }
): Promise<Uint8Array> {
	assert(context.user.address === roomRegistration.creator)
	for (const member of roomRegistration.members) {
		await validateUserRegistration(member)
	}

	const creatorAddress = hexToBytes(context.user.address)
	const members = roomRegistration.members.map(serializeUser)
	return encodeSignedData(Messages.RoomRegistration.encode({ creatorAddress, members }), context)
}

export async function decodeRoomRegistration(value: Uint8Array): Promise<RoomRegistration> {
	const { data, publicKey } = decodeSignedData(value)
	const roomRegistration = Messages.RoomRegistration.decode(data)
	const creator = roomRegistration.members.find((member) => equals(roomRegistration.creatorAddress, member.address))
	assert(creator !== undefined, "room creator is not in members array")
	assert(creator.keyBundle !== undefined, "room creator is missing key bundle")
	assert(equals(publicKey, creator.keyBundle.signingPublicKey), "room creator did not sign the room registration")

	const creatorAddress = getAddress(bytesToHex(roomRegistration.creatorAddress))
	const members = roomRegistration.members.map(parseUser)
	for (const member of members) {
		await validateUserRegistration(member)
	}

	return { creator: creatorAddress, members }
}

export async function encodeEncryptedEvent(
	encryptedEvent: Messages.EncryptedEvent,
	user: PrivateUserRegistration
): Promise<Uint8Array> {
	return encodeSignedData(Messages.EncryptedEvent.encode(encryptedEvent), { user })
}

export async function decodeEncryptedEvent(value: Uint8Array, room: Room): Promise<Messages.EncryptedEvent> {
	const signedData = decodeSignedData(value)
	const encryptedEvent = Messages.EncryptedEvent.decode(signedData.data)
	assert(encryptedEvent.roomId === room.id, "event is for the wrong room")

	const senderAddress = getAddress(bytesToHex(encryptedEvent.senderAddress))
	const creator = room.members.find((member) => member.address === senderAddress)
	assert(creator !== undefined, "event sender is not a member of the room")

	assert(encryptedEvent.recipients.length > 0, "event has no recipients")
	assert(encryptedEvent.recipients.length === room.members.length - 1, "event has the wrong number of recipients")

	const recipientPublicKeys = new Set(encryptedEvent.recipients.map((recipient) => bytesToHex(recipient.publicKey)))
	for (const member of room.members) {
		if (member.address === senderAddress) {
			continue
		} else {
			assert(recipientPublicKeys.has(member.keyBundle.encryptionPublicKey), `missing recipient for ${member.address}`)
		}
	}

	const senderPublicKey = bytesToHex(signedData.publicKey)
	assert(creator.keyBundle.signingPublicKey === senderPublicKey, "event not signed by the declared sender")

	return encryptedEvent
}

export async function decryptRoomEvent(
	encryptedEvent: Messages.EncryptedEvent,
	room: Room,
	user: PrivateUserRegistration
): Promise<RoomEvent> {
	let decryptedEvent: Uint8Array | null

	const senderAddress = getAddress(bytesToHex(encryptedEvent.senderAddress))
	if (senderAddress === user.address) {
		assert(encryptedEvent.recipients.length > 0)
		const [recipient] = encryptedEvent.recipients
		decryptedEvent = nacl.box.open(
			recipient.ciphertext,
			encryptedEvent.nonce,
			recipient.publicKey,
			hexToBytes(user.encryptionPrivateKey)
		)
	} else {
		const sender = room.members.find((member) => member.address === senderAddress)
		assert(sender !== undefined, "event sender is not a room member")

		const encryptionPublicKey = hexToBytes(user.keyBundle.encryptionPublicKey)
		const recipient = encryptedEvent.recipients.find((recipient) => equals(recipient.publicKey, encryptionPublicKey))

		assert(recipient !== undefined, "event has no recipient for the user's public key")

		decryptedEvent = nacl.box.open(
			recipient.ciphertext,
			encryptedEvent.nonce,
			hexToBytes(sender.keyBundle.encryptionPublicKey),
			hexToBytes(user.encryptionPrivateKey)
		)
	}

	assert(decryptedEvent !== null, "failed to decrypt event")

	const commitment = blake3.create({ dkLen: 16 })
	commitment.update(encryptedEvent.nonce)
	commitment.update(decryptedEvent)

	assert(equals(commitment.digest(), encryptedEvent.commitment), "invalid event commitment")

	const timestamp = Number(encryptedEvent.timestamp)
	assert(Number.isSafeInteger(timestamp), "invalid timestamp")

	const { type, detail } = cbor.decode(decryptedEvent) as { type: string; detail: any }
	if (type === "message") {
		return { type, roomId: room.id, sender: senderAddress, timestamp, detail }
	} else {
		throw new Error("invalid event type")
	}
}
