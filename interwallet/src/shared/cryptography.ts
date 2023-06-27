import nacl from "tweetnacl"

import { WalletClient } from "viem"
import { getAddress, bytesToHex, hexToBytes, keccak256 } from "viem/utils"

import { type KeyBundle, type PrivateUserRegistration } from "./types.js"

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
