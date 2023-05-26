import { privateKeyToAccount } from "viem/accounts"
import {
	MessageTypes,
	TypedMessage,
	decryptSafely,
	encryptSafely,
	getEncryptionPublicKey,
	personalSign,
	recoverPersonalSignature,
	recoverTypedSignature,
	SignTypedDataVersion,
} from "@metamask/eth-sig-util"

import { equals } from "uint8arrays"
import { bytesToHex, getAddress, hexToBytes } from "viem/utils"

import { base64pad } from "multiformats/bases/base64"

import * as Messages from "#protocols/messages"

import { KeyBundle, PrivateUserRegistration, PublicUserRegistration } from "./interfaces"

export const getPublicUserRegistration = ({ privateKey: _, ...user }: PrivateUserRegistration) => user

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
			{ name: "signingAddress", type: "address" },
			{ name: "encryptionPublicKey", type: "bytes" },
		],
	}

	// these return types match what's expected by `eth-sig-util`
	return { types, primaryType: "KeyBundle", domain, message: keyBundle }
}

export async function signKeyBundle(address: string, keyBundle: KeyBundle): Promise<`0x${string}`> {
	const typedKeyBundle = constructTypedKeyBundle(keyBundle)
	return (window as any).ethereum.request({
		method: "eth_signTypedData_v4",
		params: [address, JSON.stringify(typedKeyBundle)],
	})
}

export function verifyKeyBundle(signedUserRegistration: Messages.SignedUserRegistration): PublicUserRegistration {
	assert(signedUserRegistration.keyBundle, "missing keyBundle")
	assert(signedUserRegistration.keyBundle.signingAddress, "missing keyBundle.signingAddress")
	assert(signedUserRegistration.keyBundle.encryptionPublicKey, "missing keyBundle.encryptionPublicKey")

	const keyBundle: KeyBundle = {
		signingAddress: getAddress(bytesToHex(signedUserRegistration.keyBundle.signingAddress)),
		encryptionPublicKey: bytesToHex(signedUserRegistration.keyBundle.encryptionPublicKey),
	}

	const typedKeyBundle = constructTypedKeyBundle(keyBundle)

	const keyBundleSignature = bytesToHex(signedUserRegistration.signature)
	const address = getAddress(
		recoverTypedSignature({
			version: SignTypedDataVersion.V4,
			data: typedKeyBundle,
			signature: keyBundleSignature,
		})
	) as `0x${string}`

	assert(equals(hexToBytes(address), signedUserRegistration.address), "invalid signature")

	return { address, keyBundle, keyBundleSignature }
}

export function makeKeyBundle(privateKey: `0x${string}`): KeyBundle {
	const privateKeyAccount = privateKeyToAccount(privateKey)
	const encryptionPublicKey = getEncryptionPublicKey(privateKey.slice(2))
	return {
		signingAddress: getAddress(privateKeyAccount.address),
		encryptionPublicKey: bytesToHex(base64pad.baseDecode(encryptionPublicKey)),
	}
}

const ENCRYPTION_VERSION = "x25519-xsalsa20-poly1305"

export function signData(data: Uint8Array, sender: PrivateUserRegistration): Messages.SignedData {
	const privateKey = Buffer.from(hexToBytes(sender.privateKey))
	const signature = personalSign({ privateKey, data }) as `0x${string}`
	return Messages.SignedData.create({
		signature: hexToBytes(signature),
		payload: data,
	})
}

export function verifyData(signedData: Messages.SignedData): `0x${string}` {
	return recoverPersonalSignature({
		data: signedData.payload,
		signature: bytesToHex(signedData.signature),
	}) as `0x${string}`
}

export function encryptData(data: Uint8Array, recipient: PublicUserRegistration): Messages.EncryptedData {
	const encryptionPublicKey = hexToBytes(recipient.keyBundle.encryptionPublicKey)
	const encryptedData = encryptSafely({
		publicKey: base64pad.baseEncode(encryptionPublicKey),
		data: base64pad.baseEncode(data),
		version: ENCRYPTION_VERSION,
	})

	return Messages.EncryptedData.create({
		publicKey: encryptionPublicKey,
		version: encryptedData.version,
		nonce: base64pad.baseDecode(encryptedData.nonce),
		ciphertext: base64pad.baseDecode(encryptedData.ciphertext),
		ephemPublicKey: base64pad.baseDecode(encryptedData.ephemPublicKey),
	})
}

export function decryptData(encryptedData: Messages.EncryptedData, recipient: PrivateUserRegistration): Uint8Array {
	assert(encryptedData.version === ENCRYPTION_VERSION, "invalid encryption version")
	assert(
		equals(hexToBytes(recipient.keyBundle.encryptionPublicKey), encryptedData.publicKey),
		"wrong encryption public key"
	)

	const decryptedData = decryptSafely({
		privateKey: recipient.privateKey.slice(2),
		encryptedData: {
			version: encryptedData.version,
			ciphertext: base64pad.baseEncode(encryptedData.ciphertext),
			nonce: base64pad.baseEncode(encryptedData.nonce),
			ephemPublicKey: base64pad.baseEncode(encryptedData.ephemPublicKey),
		},
	})

	return base64pad.baseDecode(decryptedData)
}

export function assert(condition: unknown, message?: string): asserts condition {
	if (condition) {
		return
	} else {
		throw new Error(message ?? "assertion error")
	}
}
