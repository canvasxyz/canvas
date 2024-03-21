import test from "ava"

import { base58btc } from "multiformats/bases/base58"
import { encodeURI, decodeURI } from "@canvas-js/signatures"

// https://github.com/w3c-ccg/did-method-key/blob/main/test-vectors/secp256k1.json
const testVector = {
	"did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme": {
		seed: "9085d2bef69286a6cbb51623c8fa258629945cd55ca705cc4e66700396894e0c",
		verificationKeyPair: {
			id: "#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			type: "EcdsaSecp256k1VerificationKey2019",
			controller: "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			publicKeyBase58: "23o6Sau8NxxzXcgSc3PLcNxrzrZpbLeBn1izfv3jbKhuv",
			privateKeyBase58: "AjA4cyPUbbfW5wr6iZeRbJLhgH3qDt6q6LMkRw36KpxT",
		},
		didDocument: {
			"@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/secp256k1-2019/v1"],
			id: "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			verificationMethod: [
				{
					id: "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
					type: "EcdsaSecp256k1VerificationKey2019",
					controller: "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
					publicKeyBase58: "23o6Sau8NxxzXcgSc3PLcNxrzrZpbLeBn1izfv3jbKhuv",
				},
			],
			assertionMethod: [
				"did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			],
			authentication: [
				"did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			],
			capabilityInvocation: [
				"did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			],
			capabilityDelegation: [
				"did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			],
			keyAgreement: [
				"did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme#zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
			],
		},
	},
}

test("encode publicKey as did:key URI", async (t) => {
	const uri = "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme"
	const publicKeyBase58 = testVector[uri].verificationKeyPair.publicKeyBase58
	const didURI = encodeURI("secp256k1", base58btc.decode("z" + publicKeyBase58))
	t.is(didURI, uri)
})
test("decode did:key URI to publicKey", async (t) => {
	const uri = "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme"
	const { publicKey, type } = decodeURI(uri)
	t.is(type, "secp256k1")
	t.is(base58btc.encode(publicKey), "z" + testVector[uri].verificationKeyPair.publicKeyBase58)
})
