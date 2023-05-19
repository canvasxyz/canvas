import { MessageTypes, TypedMessage, getEncryptionPublicKey } from "@metamask/eth-sig-util"
import { privateKeyToAccount } from "viem/accounts"

import { KeyBundle } from "./interfaces"

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
	console.log("encryptionPublicKey", encryptionPublicKey)
	return {
		signingAddress: privateKeyAccount.address,
		encryptionPublicKey: encryptionPublicKey,
	}
}
