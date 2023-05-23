import { privateKeyToAccount } from "viem/accounts"
import {
	EthEncryptedData,
	MessageTypes,
	TypedMessage,
	decryptSafely,
	encryptSafely,
	getEncryptionPublicKey,
	personalSign,
	recoverPersonalSignature,
} from "@metamask/eth-sig-util"
import { equals } from "uint8arrays"
import { bytesToHex, hexToBytes } from "viem/utils"
import { base64pad } from "multiformats/bases/base64"
import { CBORValue, CBORMap, encode, decode } from "microcbor"

import Events from "#protocols/events"

import { KeyBundle, PrivateUserRegistration } from "./interfaces"

import { RoomEvent } from "./stores/services"

export const getRegistrationKey = (address: string) => `/interwallet/v0/registration/${address}`

const buildMagicString = (pin: string) => `[Password: ${pin}]

Generate a new messaging key?

Signing this message will allow the application to read & write messages from your address.

Only do this when setting up your messaging client or mobile application.`

export function signMagicString(account: string, pin: string): Promise<`0x${string}`> {
	const magicString = buildMagicString(pin)
	return (window as any).ethereum.request({
		method: "personal_sign",
		params: [account, magicString],
	})
}

function constructTypedKeyBundle(keyBundle: KeyBundle): TypedMessage<MessageTypes> {
	const domain = { name: "InterwalletChat" }

	const types = {
		EIP712Domain: [{ name: "name", type: "string" }],
		KeyBundle: [
			{ name: "signingAddress", type: "string" },
			{ name: "encryptionPublicKey", type: "string" },
		],
	}

	// these return types match what's expected by `eth-sig-util`
	return { types, primaryType: "KeyBundle", domain, message: keyBundle }
}

export async function signKeyBundle(address: string, keyBundle: KeyBundle) {
	const typedKeyBundle = constructTypedKeyBundle(keyBundle)
	console.log(typedKeyBundle)

	return (window as any).ethereum.request({
		method: "eth_signTypedData_v4",
		params: [address, JSON.stringify(typedKeyBundle)],
	})
}

export async function metamaskGetPublicKey(account: string): Promise<Buffer> {
	const keyB64: string = await (window as any).ethereum.request({
		method: "eth_getEncryptionPublicKey",
		params: [account],
	})

	return Buffer.from(keyB64, "base64")
}

export function makeKeyBundle(privateKey: `0x${string}`): KeyBundle {
	const privateKeyAccount = privateKeyToAccount(privateKey)
	const encryptionPublicKey = getEncryptionPublicKey(privateKey.slice(2))
	return {
		signingAddress: privateKeyAccount.address,
		encryptionPublicKey: bytesToHex(base64pad.baseDecode(encryptionPublicKey)),
	}
}

const ENCRYPTION_VERSION = "x25519-xsalsa20-poly1305"

export function signAndEncryptEvent(
	sender: PrivateUserRegistration,
	recipient: KeyBundle,
	event: RoomEvent
): Events.EncryptedEvent {
	const payload = encode(event)
	const privateKey = Buffer.from(hexToBytes(sender.privateKey))

	const signature = personalSign({ privateKey, data: payload }) as `0x${string}`
	const signedEventData = Events.SignedEvent.encode({
		signature: hexToBytes(signature),
		payload: payload,
	}).finish()

	const encryptionPublicKey = hexToBytes(recipient.encryptionPublicKey)
	const encryptedData = encryptSafely({
		publicKey: base64pad.baseEncode(encryptionPublicKey),
		data: base64pad.baseEncode(signedEventData),
		version: ENCRYPTION_VERSION,
	})

	return Events.EncryptedEvent.create({
		publicKey: encryptionPublicKey,
		version: encryptedData.version,
		nonce: base64pad.baseDecode(encryptedData.nonce),
		ciphertext: base64pad.baseDecode(encryptedData.ciphertext),
		ephemPublicKey: base64pad.baseDecode(encryptedData.ephemPublicKey),
	})
}

export function decryptAndVerifyEvent(
	user: PrivateUserRegistration,
	encryptedEvent: Events.EncryptedEvent
): { from: `0x${string}`; event: RoomEvent } {
	assert(encryptedEvent.version === ENCRYPTION_VERSION, "invalid encryption version")
	assert(
		equals(hexToBytes(user.keyBundle.encryptionPublicKey), encryptedEvent.publicKey),
		"wrong encryption public key"
	)

	const encryptedData: EthEncryptedData = {
		version: encryptedEvent.version,
		ciphertext: base64pad.baseEncode(encryptedEvent.ciphertext),
		nonce: base64pad.baseEncode(encryptedEvent.nonce),
		ephemPublicKey: base64pad.baseEncode(encryptedEvent.ephemPublicKey),
	}

	const decryptedData = decryptSafely({ privateKey: user.privateKey.slice(2), encryptedData })

	const data = base64pad.baseDecode(decryptedData)

	const signedEvent = Events.SignedEvent.decode(data)

	const address = recoverPersonalSignature({
		data: signedEvent.payload,
		signature: bytesToHex(signedEvent.signature),
	})

	const event = decode(signedEvent.payload)
	assert(isEvent(event), "invalid event value")

	return { from: address as `0x${string}`, event: event as RoomEvent }
}

function isCBORMap(value: CBORValue): value is CBORMap {
	if (value === undefined || value === null) {
		return false
	} else if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
		return false
	} else if (value instanceof Uint8Array || Array.isArray(value)) {
		return false
	} else {
		return true
	}
}

function isEvent(event: CBORValue): event is { type: string; detail: CBORMap } {
	if (isCBORMap(event)) {
		return typeof event.type === "string" && isCBORMap(event.detail)
	} else {
		return false
	}
}

function assert(condition: unknown, message?: string): asserts condition {
	if (condition) {
		return
	} else {
		throw new Error(message ?? "assertion error")
	}
}
