import { encrypt } from "@metamask/eth-sig-util"

export const buildMagicString = (pin: string) => {
	return `[Password: ${pin}]

  Generate a new messaging key?

  Signing this message will allow the application to read & write messages from your address.

  Only do this when setting up your messaging client or mobile application.
  `
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
