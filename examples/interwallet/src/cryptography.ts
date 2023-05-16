import { MessageTypes, TypedMessage, getEncryptionPublicKey } from "@metamask/eth-sig-util"
import { privateKeyToAccount } from "viem/accounts"
import { keccak256, toHex, fromHex } from "viem/utils"
import { bytesToHex } from "@noble/hashes/utils"
import { base64 } from "multiformats/bases/base64"

import { KeyBundle, UserRegistration } from "./interfaces"

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

// export function metamaskEncryptData(publicKey: Buffer, data: Buffer): Buffer {
// 	// Returned object contains 4 properties: version, ephemPublicKey, nonce, ciphertext
// 	// Each contains data encoded using base64, version is always the same string
// 	const enc = encryptSafely({
// 		publicKey: publicKey.toString("base64"),
// 		data: data.toString("base64"),
// 		version: "x25519-xsalsa20-poly1305",
// 	})

// 	const buf = Buffer.concat([
// 		Buffer.from(enc.ephemPublicKey, "base64"),
// 		Buffer.from(enc.nonce, "base64"),
// 		Buffer.from(enc.ciphertext, "base64"),
// 	])

// 	// Return just the Buffer to make the function directly compatible with decryptData function
// 	return buf
// }

// export async function metamaskDecryptData(account: string, data: Buffer): Promise<Buffer> {
// 	// Reconstructing the original object outputed by encryption
// 	const structuredData = {
// 		version: "x25519-xsalsa20-poly1305",
// 		ephemPublicKey: data.subarray(0, 32).toString("base64"),
// 		nonce: data.subarray(32, 56).toString("base64"),
// 		ciphertext: data.subarray(56).toString("base64"),
// 	}

// 	// Convert data to hex string required by MetaMask
// 	const ct = `0x${Buffer.from(JSON.stringify(structuredData), "utf8").toString("hex")}`

// 	// Send request to MetaMask to decrypt the ciphertext
// 	// Once again application must have acces to the account
// 	const decrypt = await (window as any).ethereum.request({
// 		method: "eth_decrypt",
// 		params: [ct, account],
// 	})

// 	// Decode the base85 to final bytes
// 	return Buffer.from(decrypt, "base64")
// }

export function makeKeyBundle(privateKey: `0x${string}`): KeyBundle {
	const privateKeyAccount = privateKeyToAccount(privateKey)
	const encryptionPublicKey = getEncryptionPublicKey(privateKey.slice(2))
	console.log("encryptionPublicKey", encryptionPublicKey)
	return {
		signingAddress: privateKeyAccount.address,
		encryptionPublicKey: encryptionPublicKey,
	}
}
