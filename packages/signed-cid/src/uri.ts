import { varint } from "multiformats"
import { base58btc } from "multiformats/bases/base58"

import type { SignatureType } from "@canvas-js/interfaces"

const codecs = {
	ed25519: 0xe7,
	secp256k1: 0xed,
}

export function getPublicKeyURI(publicKeyType: SignatureType, publicKey: Uint8Array): string {
	const encodingLength = varint.encodingLength(codecs[publicKeyType])
	const buffer = new Uint8Array(encodingLength + publicKey.byteLength)
	varint.encodeTo(codecs[publicKeyType], buffer, 0)
	buffer.set(publicKey, encodingLength)
	return `did:key:${base58btc.encode(buffer)}`
}
