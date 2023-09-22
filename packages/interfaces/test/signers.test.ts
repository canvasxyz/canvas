import test from "ava"

import { Action, ActionArguments, Message, Signer } from "@canvas-js/interfaces"
import { verifySignature } from "@canvas-js/signed-cid"

import { SIWESigner } from "@canvas-js/chain-ethereum"
// import { SolanaSigner } from "@canvas-js/chain-solana"
// import { SubstrateSigner } from "@canvas-js/chain-substrate"

type SignerImplementation = { createSigner: () => Promise<Signer>; name: string }

const SIGNER_IMPLEMENTATIONS: SignerImplementation[] = [
	{
		name: "ethereum",
		createSigner: async () => new SIWESigner(),
	},
	// {
	// 	name: "solana",
	// 	createSigner: async () => SolanaSigner.initWithKeypair(),
	// },
	// {
	// 	name: "substrate",
	// 	createSigner: async () => SubstrateSigner.initWithKeypair(),
	// },
]

// async function createMessage(
// 	signer: Signer,
// 	topic: string,
// 	name: string,
// 	args: ActionArguments
// ): Promise<Message<Action>> {
// 	const [chain, address, session] = await signer.getSession()
// 	const timestamp = Date.now()
// 	const action: Action = { chain, address, session, name, args, topic, timestamp, blockhash: null }
// 	return { clock: 0, parents: [], payload: action }
// }

// function runTestSuite({ createSigner, name }: SignerImplementation) {
// 	test(`${name} - create and verify signed action`, async (t) => {
// 		const topic = "example:signer"
// 		const signer = await createSigner()
// 		const message = await createMessage(signer, topic, "foo", { bar: 7 })

// 		const signature = await signer.sign(message)
// 		t.notThrows(() => verifySignature(signature, message))

// 		const { chain, address, session } = message.payload
// 		await t.notThrowsAsync(async () => signer.verifySession(signature, chain, address, session))
// 	})

// 	test(`${name} - verification fails for invalid message signatures`, async (t) => {
// 		const topic = "example:signer"
// 		const signer = await createSigner()
// 		const message_1 = await createMessage(signer, topic, "foo", { bar: 7 })
// 		const message_2 = await createMessage(signer, topic, "baz", { qux: 7 })
// 		const signature_1 = await signer.sign(message_1)
// 		const signature_2 = await signer.sign(message_2)
// 		t.throws(() => verifySignature(signature_1, message_2))
// 		t.throws(() => verifySignature(signature_2, message_1))
// 	})

// 	test(`${name} - verification fails for invalid session payloads`, async (t) => {
// 		const topic = "example:signer"
// 		const signer_1 = await createSigner()
// 		const signer_2 = await createSigner()
// 		const message_1 = await createMessage(signer_1, topic, "foo", { bar: 7 })
// 		const message_2 = await createMessage(signer_2, topic, "foo", { bar: 7 })
// 		const signature_1 = await signer_1.sign(message_1)
// 		const signature_2 = await signer_2.sign(message_2)

// 		const { chain: chain_1, address: address_1, session: session_1 } = message_1.payload
// 		const { chain: chain_2, address: address_2, session: session_2 } = message_2.payload

// 		await t.throwsAsync(async () => signer_1.verifySession(signature_1, chain_1, address_1, session_2))
// 		await t.throwsAsync(async () => signer_2.verifySession(signature_2, chain_2, address_2, session_1))
// 	})

// 	test(`${name} - verification fails for invalid addresses`, async (t) => {
// 		const topic = "example:signer"
// 		const signer_1 = await createSigner()
// 		const signer_2 = await createSigner()
// 		const message_1 = await createMessage(signer_1, topic, "foo", { bar: 7 })
// 		const message_2 = await createMessage(signer_2, topic, "foo", { bar: 7 })
// 		const signature_1 = await signer_1.sign(message_1)
// 		const signature_2 = await signer_2.sign(message_2)

// 		const { chain: chain_1, address: address_1, session: session_1 } = message_1.payload
// 		const { chain: chain_2, address: address_2, session: session_2 } = message_2.payload

// 		await t.throwsAsync(async () => signer_1.verifySession(signature_1, chain_1, address_2, session_1))
// 		await t.throwsAsync(async () => signer_2.verifySession(signature_2, chain_2, address_1, session_2))
// 	})

// 	test(`${name} - different signers successfully verify each other's sessions`, async (t) => {
// 		const topic = "example:signer"
// 		const signer_1 = await createSigner()
// 		const signer_2 = await createSigner()
// 		const message_1 = await createMessage(signer_1, topic, "foo", { bar: 7 })
// 		const message_2 = await createMessage(signer_2, topic, "baz", { qux: 7 })
// 		const signature_1 = await signer_1.sign(message_1)
// 		const signature_2 = await signer_2.sign(message_2)

// 		const { chain: chain_1, address: address_1, session: session_1 } = message_1.payload
// 		const { chain: chain_2, address: address_2, session: session_2 } = message_2.payload

// 		await t.notThrowsAsync(async () => signer_1.verifySession(signature_2, chain_2, address_2, session_2))
// 		await t.notThrowsAsync(async () => signer_2.verifySession(signature_1, chain_1, address_1, session_1))
// 	})
// }

// for (const implementation of SIGNER_IMPLEMENTATIONS) {
// 	runTestSuite(implementation)
// }
