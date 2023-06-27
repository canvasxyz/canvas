import { bytesToHex, hexToBytes, recoverTypedDataAddress } from "viem"
import * as Messages from "./messages.js"
import { KeyBundle } from "./types"
import { assert } from "./utils.js"
import { equals } from "uint8arrays"

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

export class PublicUserRegistration {
	readonly address: `0x${string}`
	readonly keyBundle: KeyBundle
	readonly keyBundleSignature: `0x${string}`

	constructor(address: `0x${string}`, keyBundle: KeyBundle, keyBundleSignature: `0x${string}`) {
		this.address = address
		this.keyBundle = keyBundle
		this.keyBundleSignature = keyBundleSignature
	}

	async validate() {
		const typedKeyBundle = constructTypedKeyBundle(this.keyBundle)

		const address = await recoverTypedDataAddress({
			...typedKeyBundle,
			signature: this.keyBundleSignature,
		})

		assert(equals(hexToBytes(address), hexToBytes(this.address)), "invalid signature")
	}

	static decode(value: Uint8Array): PublicUserRegistration {
		const { address, keyBundle, signature } = Messages.SignedUserRegistration.decode(value)
		return new PublicUserRegistration(
			bytesToHex(address),
			{
				encryptionPublicKey: bytesToHex(keyBundle!.encryptionPublicKey),
				signingPublicKey: bytesToHex(keyBundle!.signingPublicKey),
			},
			bytesToHex(signature)
		)
	}

	static encode({ address, keyBundle, keyBundleSignature }: PublicUserRegistration): Uint8Array {
		return Messages.SignedUserRegistration.encode({
			address: hexToBytes(address),
			keyBundle: {
				encryptionPublicKey: hexToBytes(keyBundle.encryptionPublicKey),
				signingPublicKey: hexToBytes(keyBundle.signingPublicKey),
			},
			signature: hexToBytes(keyBundleSignature),
		})
	}
}
