import type { WalletClient } from "viem"
import { getAddress, bytesToHex, hexToBytes, keccak256 } from "viem/utils"

import nacl from "tweetnacl"

import { constructTypedKeyBundle, KeyBundle, PrivateUserRegistration } from "../shared/index.js"

export const getRegistrationKey = (address: string) => `/interwallet/v0/registration/${address}`

const buildMagicString = (pin: string) => `[Password: ${pin}]

Generate a new messaging key?

Signing this message will allow the application to read & write messages from your address.

Only do this when setting up your messaging client or mobile application.`

export async function createPrivateUserRegistration(
	walletClient: WalletClient,
	account: `0x${string}`,
	pin: string
): Promise<PrivateUserRegistration> {
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