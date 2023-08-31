import test from "ava"

import { nanoid } from "nanoid"
import { ed25519 } from "@noble/curves/ed25519"

import { Signature, createSignature } from "@canvas-js/signed-cid"
import { IPLDValue, Message } from "@canvas-js/interfaces"

import openMessageLog from "@canvas-js/gossiplog/store"

const validateString = (payload: unknown): payload is string => true

class Ed25519Signer<T = unknown> {
	private readonly privateKey = ed25519.utils.randomPrivateKey()
	public readonly publicKey = ed25519.getPublicKey(this.privateKey)

	sign(message: Message<T>) {
		return createSignature("ed25519", this.privateKey, message)
	}
}

test("apply a signed message", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateString,
	})

	const signer = new Ed25519Signer()
	const { id, result } = await log.append("foo", { signer })

	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: signer.publicKey, message: { clock: 1, parents: [], payload: "foo" } }])
})

test("apply a signed message without sequencing", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateString,
		sequencing: false,
	})

	const signer = new Ed25519Signer()
	const { id, result } = await log.append("foo", { signer })
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: signer.publicKey, message: { clock: 0, parents: [], payload: "foo" } }])
})

test("apply an unsigned message", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateString,
		signatures: false,
	})

	const { id, result } = await log.append("foo")
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: null, message: { clock: 1, parents: [], payload: "foo" } }])
})

test("apply an unsigned message without sequencing", async (t) => {
	const messages: IPLDValue[] = []
	const log = await openMessageLog({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => void messages.push({ id, publicKey: signature?.publicKey ?? null, message }),
		validate: validateString,
		signatures: false,
		sequencing: false,
	})

	const { id, result } = await log.append("foo")
	t.is(result, undefined)
	t.deepEqual(messages, [{ id, publicKey: null, message: { clock: 0, parents: [], payload: "foo" } }])
})

test("apply two messages in serial", async (t) => {
	const messages: Record<string, [Signature | null, Message]> = {}
	const log = await openMessageLog<string, void>({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages[message.payload] = [signature, message]
		},
		validate: (payload): payload is string => typeof payload === "string",
		signatures: false,
	})

	const [a, b] = [nanoid(), nanoid()]
	const { id: idA } = await log.append(a)
	const { id: idB } = await log.append(b)
	t.deepEqual(messages, {
		[a]: [null, { clock: 1, parents: [], payload: a }],
		[b]: [null, { clock: 2, parents: [idA], payload: b }],
	})
})

test("apply two concurrent messages", async (t) => {
	const messages: Record<string, [Signature | null, Message]> = {}
	const log = await openMessageLog<string, void>({
		location: null,
		topic: "com.example.test",
		apply: (id, signature, message) => {
			messages[message.payload] = [signature, message]
		},
		validate: (payload): payload is string => typeof payload === "string",
		signatures: false,
	})

	const [a, b] = [nanoid(), nanoid()]
	await log.insert(null, { clock: 1, parents: [], payload: a })
	await log.insert(null, { clock: 1, parents: [], payload: b })

	t.deepEqual(messages, {
		[a]: [null, { clock: 1, parents: [], payload: a }],
		[b]: [null, { clock: 1, parents: [], payload: b }],
	})
})
