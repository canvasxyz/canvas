import { MessageTypes, TypedMessage, encrypt, getEncryptionPublicKey } from "@metamask/eth-sig-util"
import { KeyBundle } from "./models"
import { extractPublicKey, personalSign } from "@metamask/eth-sig-util"
import { keccak256 } from "@ethersproject/keccak256"

export const buildMagicString = (pin: string) => {
	return `[Password: ${pin}]

  Generate a new messaging key?

  Signing this message will allow the application to read & write messages from your address.

  Only do this when setting up your messaging client or mobile application.
  `
}

export const constructTypedKeyBundle = (keyBundle: KeyBundle): TypedMessage<MessageTypes> => {
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

export const signKeyBundle = async (address: string, keyBundle: KeyBundle) => {
	const typedKeyBundle = constructTypedKeyBundle(keyBundle)
	console.log(typedKeyBundle)

	return (window as any).ethereum.request({
		method: "eth_signTypedData_v4",
		params: [address, JSON.stringify(typedKeyBundle)],
	})
}

export async function metamaskGetPublicKey(account: string): Promise<Buffer> {
	const keyB64 = (await (window as any).ethereum.request({
		method: "eth_getEncryptionPublicKey",
		params: [account],
	})) as string
	return Buffer.from(keyB64, "base64")
}

export function metamaskEncryptData(publicKey: Buffer, data: Buffer): Buffer {
	// Returned object contains 4 properties: version, ephemPublicKey, nonce, ciphertext
	// Each contains data encoded using base64, version is always the same string
	const enc = encrypt({
		publicKey: publicKey.toString("base64"),
		data: data.toString("base64"),
		version: "x25519-xsalsa20-poly1305",
	})

	const buf = Buffer.concat([
		Buffer.from(enc.ephemPublicKey, "base64"),
		Buffer.from(enc.nonce, "base64"),
		Buffer.from(enc.ciphertext, "base64"),
	])

	// Return just the Buffer to make the function directly compatible with decryptData function
	return buf
}

export async function metamaskDecryptData(account: string, data: Buffer): Promise<Buffer> {
	// Reconstructing the original object outputed by encryption
	const structuredData = {
		version: "x25519-xsalsa20-poly1305",
		ephemPublicKey: data.subarray(0, 32).toString("base64"),
		nonce: data.subarray(32, 56).toString("base64"),
		ciphertext: data.subarray(56).toString("base64"),
	}
	// Convert data to hex string required by MetaMask
	const ct = `0x${Buffer.from(JSON.stringify(structuredData), "utf8").toString("hex")}`
	// Send request to MetaMask to decrypt the ciphertext
	// Once again application must have acces to the account
	const decrypt = await (window as any).ethereum.request({
		method: "eth_decrypt",
		params: [ct, account],
	})
	// Decode the base85 to final bytes
	return Buffer.from(decrypt, "base64")
}

const getPublicKeyFromPrivateKey = (privateKey: Buffer) => {
	const data = "arbitrary data"
	const signature = personalSign({ data, privateKey })
	const publicKey = extractPublicKey({ data, signature })
	const hash = keccak256(publicKey)
	return `0x${hash.slice(-40)}`
}

export const makeKeyBundle = (privateKey: Buffer): KeyBundle => {
	const signingAddress = getPublicKeyFromPrivateKey(privateKey)
	const encryptionPublicKey = getEncryptionPublicKey(privateKey.toString("hex"))
	return { signingAddress, encryptionPublicKey }
}
