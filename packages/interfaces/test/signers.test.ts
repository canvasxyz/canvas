import test from "ava"

import { Message, Session, SessionSigner as Signer } from "@canvas-js/interfaces"
import { verifySignedValue } from "@canvas-js/signed-cid"

import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { NEARSigner } from "@canvas-js/chain-near"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { SolanaSigner } from "@canvas-js/chain-solana"
import { SubstrateSigner } from "@canvas-js/chain-substrate"
// import { ATPSigner } from "@canvas-js/chain-atp"

type SignerImplementation = { createSigner: () => Promise<Signer>; name: string }

const SIGNER_IMPLEMENTATIONS: SignerImplementation[] = [
	{
		name: "chain-cosmos",
		createSigner: async () => new CosmosSigner(),
	},
	{
		name: "chain-near",
		createSigner: async () => new NEARSigner(),
	},
	{
		name: "chain-ethereum",
		createSigner: async () => new SIWESigner(),
	},
	{
		name: "chain-solana",
		createSigner: async () => new SolanaSigner(),
	},
	{
		name: "chain-substrate-sr25519",
		createSigner: async () => new SubstrateSigner({ substrateKeyType: "sr25519" }),
	},
	{
		name: "chain-substrate-ed25519",
		createSigner: async () => new SubstrateSigner({ substrateKeyType: "ed25519" }),
	},
	{
		name: "chain-substrate-ecdsa",
		createSigner: async () => new SubstrateSigner({ substrateKeyType: "ecdsa" }),
	},
	{
		name: "chain-substrate-ethereum",
		createSigner: async () => new SubstrateSigner({ substrateKeyType: "ethereum" }),
	},
]

function runTestSuite({ createSigner, name }: SignerImplementation) {
	test(`${name} - create and verify session`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()

		const session = await signer.getSession(topic)
		await t.notThrowsAsync(() => Promise.resolve(signer.verifySession(topic, session)))
	})

	test(`${name} - sign session and verify session signature`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()

		const session = await signer.getSession(topic)

		const message: Message<Session> = { topic, clock: 0, parents: [], payload: session }
		const sessionSignature = await signer.sign(message)
		t.notThrows(() => verifySignedValue(sessionSignature, message))
	})

	test(`${name} - refuse to sign foreign sessions`, async (t) => {
		const topic = "example:signer"
		const [a, b] = await Promise.all([createSigner(), createSigner()])

		const sessionA = await a.getSession(topic)
		const sessionB = await b.getSession(topic)

		await t.notThrowsAsync(async () => a.sign({ topic, clock: 0, parents: [], payload: sessionA }))
		await t.notThrowsAsync(async () => b.sign({ topic, clock: 0, parents: [], payload: sessionB }))
		await t.throwsAsync(async () => a.sign({ topic, clock: 0, parents: [], payload: sessionB }))
		await t.throwsAsync(async () => b.sign({ topic, clock: 0, parents: [], payload: sessionA }))
	})

	test(`${name} - different signers successfully verify each other's sessions`, async (t) => {
		const topic = "example:signer"
		const [a, b] = await Promise.all([createSigner(), createSigner()])

		const sessionA = await a.getSession(topic)
		const sessionB = await b.getSession(topic)

		await t.notThrowsAsync(async () => a.verifySession(topic, sessionB))
		await t.notThrowsAsync(async () => b.verifySession(topic, sessionA))
	})
}

for (const implementation of SIGNER_IMPLEMENTATIONS) {
	runTestSuite(implementation)
}
