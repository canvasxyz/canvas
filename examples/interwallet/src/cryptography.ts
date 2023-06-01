import nacl from "tweetnacl"

import { bytesToHex, getAddress, hexToBytes, recoverTypedDataAddress } from "viem/utils"

import * as Messages from "./protocols/messages"

import { KeyBundle, PrivateUserRegistration, PublicUserRegistration, WalletName } from "./interfaces"

export const getPublicUserRegistration = ({ privateKey: _, ...user }: PrivateUserRegistration) => user

export const getRegistrationKey = (address: string) => `/interwallet/v0/registration/${address}`

export const buildMagicString = (pin: string) => `[Password: ${pin}]

Generate a new messaging key?

Signing this message will allow the application to read & write messages from your address.

Only do this when setting up your messaging client or mobile application.`

export function constructTypedKeyBundle(keyBundle: KeyBundle) {
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

export async function verifyKeyBundle(
	signedUserRegistration: Messages.SignedUserRegistration
): Promise<PublicUserRegistration> {
	assert(signedUserRegistration.walletName, "missing walletName")
	assert(signedUserRegistration.keyBundle, "missing keyBundle")
	assert(signedUserRegistration.keyBundle.signingPublicKey, "missing keyBundle.signingPublicKey")
	assert(signedUserRegistration.keyBundle.encryptionPublicKey, "missing keyBundle.encryptionPublicKey")

	// deserialized keyBundle
	const keyBundle: KeyBundle = {
		signingPublicKey: bytesToHex(signedUserRegistration.keyBundle.signingPublicKey),
		encryptionPublicKey: bytesToHex(signedUserRegistration.keyBundle.encryptionPublicKey),
	}
	const keyBundleSignature = bytesToHex(signedUserRegistration.signature)

	// TODO: choose a verification method, depending on how the keyBundle was signed
	let address: `0x${string}` | null = null
	const walletName = signedUserRegistration.walletName as WalletName
	if (walletName == "metamask" || walletName == "walletconnect") {
		const typedKeyBundle = constructTypedKeyBundle(keyBundle)
		address = getAddress(
			await recoverTypedDataAddress({
				...typedKeyBundle,
				signature: keyBundleSignature,
			})
		)
	} else {
		const _exhaustiveCheck: never = walletName
		throw new Error("Unsupported wallet")
	}

	assert(address == getAddress(signedUserRegistration.address), "invalid signature")

	return { walletName: signedUserRegistration.walletName, address, keyBundle, keyBundleSignature }
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
