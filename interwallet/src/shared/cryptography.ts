import nacl from "tweetnacl"

import { WalletClient } from "viem"
import { getAddress, bytesToHex, hexToBytes, keccak256, recoverTypedDataAddress } from "viem/utils"
import { blake3 } from "@noble/hashes/blake3"
import { equals } from "uint8arrays"
import { base58btc } from "multiformats/bases/base58"
import { decode, encode } from "microcbor"
import * as Messages from "./messages.js"

import {
	serializeRoomRegistration,
	type KeyBundle,
	type PrivateUserRegistration,
	type PublicUserRegistration,
	type Room,
	type RoomRegistration,
	RoomEvent,
} from "./types.js"
import { assert } from "./utils.js"

const buildMagicString = (pin: string) => `[Password: ${pin}]

Generate a new messaging key?

Signing this message will allow the application to read & write messages from your address.

Only do this when setting up your messaging client or mobile application.`

function constructTypedKeyBundle(keyBundle: KeyBundle) {
	const types = {
		EIP712Domain: [{ name: "name", type: "string" }],
		KeyBundle: [
			{ name: "signingPublicKey", type: "bytes" },
			{ name: "encryptionPublicKey", type: "bytes" },
		],
	} as const

	// these return types match what's expected by `eth-sig-util`
	return {
		types,
		primaryType: "KeyBundle" as const,
		domain: { name: "InterwalletChat" } as const,
		message: keyBundle,
	}
}

async function verifyKeyBundle(
	signedUserRegistration: Messages.SignedUserRegistration
): Promise<PublicUserRegistration> {
	assert(signedUserRegistration.keyBundle, "missing keyBundle")
	assert(signedUserRegistration.keyBundle.signingPublicKey, "missing keyBundle.signingPublicKey")
	assert(signedUserRegistration.keyBundle.encryptionPublicKey, "missing keyBundle.encryptionPublicKey")

	const keyBundle: KeyBundle = {
		signingPublicKey: bytesToHex(signedUserRegistration.keyBundle.signingPublicKey),
		encryptionPublicKey: bytesToHex(signedUserRegistration.keyBundle.encryptionPublicKey),
	}

	const typedKeyBundle = constructTypedKeyBundle(keyBundle)

	const keyBundleSignature = bytesToHex(signedUserRegistration.signature)
	const address = await recoverTypedDataAddress({
		...typedKeyBundle,
		signature: keyBundleSignature,
	})

	assert(equals(hexToBytes(address), signedUserRegistration.address), "invalid signature")

	return { address, keyBundle, keyBundleSignature }
}

export const createPrivateUserRegistration = async (
	walletClient: WalletClient,
	account: `0x${string}`,
	pin: string
): Promise<PrivateUserRegistration> => {
	const magicString = buildMagicString(pin)
	const signature = await walletClient.signMessage({ account, message: magicString })
	const privateKey = keccak256(signature)
	const encryptionKeyPair = nacl.box.keyPair.fromSecretKey(hexToBytes(privateKey))
	const signingKeyPair = nacl.sign.keyPair.fromSeed(hexToBytes(privateKey))
	const keyBundle: KeyBundle = {
		encryptionPublicKey: bytesToHex(encryptionKeyPair.publicKey),
		signingPublicKey: bytesToHex(signingKeyPair.publicKey),
	}

	const typedKeyBundle = constructTypedKeyBundle(keyBundle)
	const keyBundleSignature = await walletClient.signTypedData({ account, ...typedKeyBundle })

	return {
		address: getAddress(account),
		keyBundleSignature,
		keyBundle,
		encryptionPrivateKey: privateKey,
		signingPrivateKey: bytesToHex(signingKeyPair.secretKey),
	}
}

export const getRoomId = (key: Uint8Array) => base58btc.baseEncode(key)

export async function validateRoomRegistration(key: Uint8Array, value: Uint8Array): Promise<Room> {
	const { signature, data: signedData } = Messages.SignedData.decode(value)
	const roomRegistration = Messages.RoomRegistration.decode(signedData)

	const hash = blake3.create({ dkLen: 16 })
	for (const member of roomRegistration.members) {
		assert(member.address, "missing member.address")
		hash.update(member.address)
	}

	assert(equals(key, hash.digest()), "invalid room registration key")

	let creator: PublicUserRegistration | null = null
	const members: PublicUserRegistration[] = []
	for (const member of roomRegistration.members) {
		const memberRegistration = await verifyKeyBundle(member)
		members.push(memberRegistration)
		if (equals(member.address, roomRegistration.creator)) {
			creator = memberRegistration
		}
	}

	assert(creator !== null, "room creator must be a member of the room")

	assert(
		nacl.sign.detached.verify(signedData, signature, hexToBytes(creator.keyBundle.signingPublicKey)),
		"invalid room registration signature"
	)

	const id = getRoomId(key)
	return { id, creator: creator.address, members }
}

export async function validateUserRegistration(key: Uint8Array, value: Uint8Array): Promise<PublicUserRegistration> {
	const signedUserRegistration = Messages.SignedUserRegistration.decode(value)
	const userRegistration = await verifyKeyBundle(signedUserRegistration)
	assert(
		equals(key, hexToBytes(userRegistration.address)),
		"invalid user registration: key is not the bytes of the address"
	)

	return userRegistration
}

export function validateEvent(
	room: Room,
	key: Uint8Array,
	value: Uint8Array
): { encryptedEvent: Messages.EncryptedEvent; sender: PublicUserRegistration } {
	assert(equals(key, blake3(value, { dkLen: 16 })), "invalid event: key is not hash of value")

	const { signature, data: signedData } = Messages.SignedData.decode(value)
	const encryptedEvent = Messages.EncryptedEvent.decode(signedData)

	assert(getRoomId(encryptedEvent.roomId) === room.id, "event is for a different room")

	const senderAddress = getAddress(bytesToHex(encryptedEvent.senderAddress))
	const sender = room.members.find((member) => member.address === senderAddress)
	assert(sender !== undefined, "sender is not a member of the room")

	assert(
		nacl.sign.detached.verify(signedData, signature, hexToBytes(sender.keyBundle.signingPublicKey)),
		"invalid event signature"
	)

	for (const eachRecipient of encryptedEvent.recipients) {
		if (eachRecipient === undefined) {
			continue
		}
		const recipientPublicKey = bytesToHex(eachRecipient.publicKey)
		const recipient = room.members.find((member) => member.keyBundle.encryptionPublicKey === recipientPublicKey)
		assert(recipient !== undefined, "recipient is not a member of the room")
	}

	return { encryptedEvent, sender }
}

export const encryptAndSignMessageForRoom = (room: Room, message: string, user: PrivateUserRegistration) => {
	const event = {
		type: "message",
		detail: { content: message, sender: user.address, timestamp: Date.now() },
	}

	const otherRoomMembers = room.members.filter(({ address }) => user.address !== address)
	assert(otherRoomMembers.length > 0, "room has no other members")

	const encryptedData = Messages.EncryptedEvent.encode({
		recipients: otherRoomMembers.map((otherRoomMember) => {
			const publicKey = hexToBytes(otherRoomMember.keyBundle.encryptionPublicKey)
			const nonce = nacl.randomBytes(nacl.box.nonceLength)
			const ciphertext = nacl.box(encode(event), nonce, publicKey, hexToBytes(user.encryptionPrivateKey))

			return {
				publicKey,
				ciphertext,
				nonce,
			}
		}),
		roomId: base58btc.baseDecode(room.id),
		senderAddress: hexToBytes(user.address),
		senderPublicKey: hexToBytes(user.keyBundle.encryptionPublicKey),
	})

	const signature = nacl.sign.detached(encryptedData, hexToBytes(user.signingPrivateKey))

	return Messages.SignedData.encode({ signature, data: encryptedData })
}

export const signAndEncodeRoomRegistration = (roomRegistration: RoomRegistration, user: PrivateUserRegistration) => {
	assert(roomRegistration.creator === user.address, "room creator must be the current user")
	assert(
		roomRegistration.members.find(({ address }) => address === user.address),
		"members did not include the current user"
	)

	const serializedRoomRegistration = Messages.RoomRegistration.encode(serializeRoomRegistration(roomRegistration))

	const signature = nacl.sign.detached(serializedRoomRegistration, hexToBytes(user.signingPrivateKey))
	return Messages.SignedData.encode({ signature, data: serializedRoomRegistration })
}

export const decryptEvent = (encryptedEvent: Messages.EncryptedEvent, user: PrivateUserRegistration) => {
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
