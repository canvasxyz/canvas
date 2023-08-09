import test from "ava"

import { secp256k1 } from "@noble/curves/secp256k1"
import { ed25519 } from "@noble/curves/ed25519"

import { createSignedValue, verifySignedValue } from "@canvas-js/signed-value"

const value = { foo: "hello world", bar: [1, 2, 3] }

test("create and verify secp256k1-signed value", (t) => {
	const privateKey = secp256k1.utils.randomPrivateKey()
	const signed = createSignedValue("secp256k1", privateKey, value)
	verifySignedValue(signed)
	t.pass()
})

test("create and verify ed25519-signed value", (t) => {
	const privateKey = ed25519.utils.randomPrivateKey()
	const signed = createSignedValue("ed25519", privateKey, value)
	verifySignedValue(signed)
	t.pass()
})
