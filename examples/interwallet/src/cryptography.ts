import { recoverTypedSignature, SignTypedDataVersion } from "@metamask/eth-sig-util"
import nacl from "tweetnacl"

import { equals } from "uint8arrays"
import { bytesToHex, getAddress, hexToBytes } from "viem/utils"

import * as Messages from "./protocols/messages"

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

function constructTypedKeyBundle(keyBundle: KeyBundle) {
	const domain = { name: "InterwalletChat" }

	const types = {
		EIP712Domain: [{ name: "name", type: "string" }],
		KeyBundle: [
			{ name: "signingPublicKey", type: "bytes" },
			{ name: "encryptionPublicKey", type: "bytes" },
		],
	}

	// these return types match what's expected by `eth-sig-util`
	return { types, primaryType: "KeyBundle" as const, domain, message: keyBundle }
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
	assert(signedUserRegistration.keyBundle.signingPublicKey, "missing keyBundle.signingPublicKey")
	assert(signedUserRegistration.keyBundle.encryptionPublicKey, "missing keyBundle.encryptionPublicKey")

	// deserialized keyBundle
	const keyBundle: KeyBundle = {
		signingPublicKey: bytesToHex(signedUserRegistration.keyBundle.signingPublicKey),
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
	const encryptionKeyPair = nacl.box.keyPair.fromSecretKey(hexToBytes(privateKey))
	const signingKeyPair = nacl.sign.keyPair.fromSeed(hexToBytes(privateKey))
	return {
		signingPublicKey: bytesToHex(signingKeyPair.publicKey),
		encryptionPublicKey: bytesToHex(encryptionKeyPair.publicKey),
	}
}

const ENCRYPTION_VERSION = "x25519-xsalsa20-poly1305"

export function signData(data: Uint8Array, sender: PrivateUserRegistration): Messages.SignedData {
	const privateKey = hexToBytes(sender.privateKey)
	const signingKeypair = nacl.sign.keyPair.fromSeed(privateKey)
	const signedMessage = nacl.sign(data, signingKeypair.secretKey)

	return {
		signedMessage,
		publicKey: signingKeypair.publicKey,
	}
}

export function assert(condition: unknown, message?: string): asserts condition {
	if (condition) {
		return
	} else {
		throw new Error(message ?? "assertion error")
	}
}
