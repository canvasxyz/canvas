import test from "ava"

import { secp256k1 } from "@noble/curves/secp256k1"
import { ed25519 } from "@noble/curves/ed25519"

import { createSignature, verifySignature } from "@canvas-js/signed-cid"

const value = { foo: "hello world", bar: [1, 2, 3] }

test("create and verify secp256k1-signed value", (t) => {
	const privateKey = secp256k1.utils.randomPrivateKey()
	const signature = createSignature("secp256k1", privateKey, value)
	verifySignature(signature, value)
	t.pass()
})

test("create and verify ed25519-signed value", (t) => {
	const privateKey = ed25519.utils.randomPrivateKey()
	const signature = createSignature("ed25519", privateKey, value)
	verifySignature(signature, value)
	t.pass()
})
