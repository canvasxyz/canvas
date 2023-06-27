import nacl from "tweetnacl"

import { WalletClient } from "viem"
import { getAddress, bytesToHex, hexToBytes, keccak256 } from "viem/utils"
import { blake3 } from "@noble/hashes/blake3"
import { equals } from "uint8arrays"
import { base58btc } from "multiformats/bases/base58"
import { decode, encode } from "microcbor"

import * as Messages from "./messages.js"
import { PublicUserRegistration } from "./PublicUserRegistration.js"
import { getRoomId } from "./RoomRegistration.js"
import { type KeyBundle, type PrivateUserRegistration, type Room, RoomEvent } from "./types.js"
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

class DerivedSecrets {
	readonly encryptionKeyPair: nacl.BoxKeyPair
	readonly signingKeyPair: nacl.SignKeyPair

	constructor(encryptionKeyPair: nacl.BoxKeyPair, signingKeyPair: nacl.SignKeyPair) {
		this.encryptionKeyPair = encryptionKeyPair
		this.signingKeyPair = signingKeyPair
	}

	getPublicKeyBundle(): KeyBundle {
		return {
			encryptionPublicKey: bytesToHex(this.encryptionKeyPair.publicKey),
			signingPublicKey: bytesToHex(this.signingKeyPair.publicKey),
		}
	}

	static kdfWithoutSalt(privateKey: Uint8Array) {
		const encryptionKeyPair = nacl.box.keyPair.fromSecretKey(privateKey)
		const signingKeyPair = nacl.sign.keyPair.fromSeed(privateKey)
		return new DerivedSecrets(encryptionKeyPair, signingKeyPair)
	}
}

const signMagicString = async (
	walletClient: WalletClient,
	account: `0x${string}`,
	pin: string
): Promise<`0x${string}`> => {
	const magicString = buildMagicString(pin)
	return await walletClient.signMessage({ account, message: magicString })
}

const signKeyBundle = async (
	walletClient: WalletClient,
	keyBundle: KeyBundle,
	account: `0x${string}`
): Promise<`0x${string}`> => {
	const typedKeyBundle = constructTypedKeyBundle(keyBundle)
	return await walletClient.signTypedData({ account, ...typedKeyBundle })
}

export const createPrivateUserRegistration = async (
	walletClient: WalletClient,
	account: `0x${string}`,
	pin: string
): Promise<PrivateUserRegistration> => {
	const signature = await signMagicString(walletClient, account, pin)

	const privateKey = keccak256(signature)

	const derivedSecrets = DerivedSecrets.kdfWithoutSalt(hexToBytes(privateKey))
	const keyBundle = derivedSecrets.getPublicKeyBundle()

	const keyBundleSignature = await signKeyBundle(walletClient, keyBundle, account)

	return {
		address: getAddress(account),
		keyBundleSignature,
		keyBundle,
		encryptionPrivateKey: privateKey,
		signingPrivateKey: bytesToHex(derivedSecrets.signingKeyPair.secretKey),
	}
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
