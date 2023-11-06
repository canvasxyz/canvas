import test from "ava"

import { Secp256k1Signer, Ed25519Signer, verifySignedValue } from "@canvas-js/signed-cid"

const value = { foo: "hello world", bar: [1, 2, 3] }

test("Secp256k1Signer", (t) => {
	const signer = new Secp256k1Signer()
	const signature = signer.sign(value)
	t.notThrows(() => verifySignedValue(signature, value))
})

test("Ed25519Signer", (t) => {
	const signer = new Ed25519Signer()
	const signature = signer.sign(value)
	t.notThrows(() => verifySignedValue(signature, value))
})
