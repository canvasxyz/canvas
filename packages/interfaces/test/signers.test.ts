import test from "ava"

import { Secp256k1Wallet, StdSignDoc } from "@cosmjs/amino"
import { secp256k1 } from "@noble/curves/secp256k1"

import { Action, Message, Session, SessionSigner as Signer } from "@canvas-js/interfaces"

import { CosmosSigner } from "@canvas-js/chain-cosmos"
import { NEARSigner } from "@canvas-js/chain-near"
import { SIWESigner, Eip712Signer } from "@canvas-js/chain-ethereum"
import { SIWESignerViem } from "@canvas-js/chain-ethereum-viem"
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
		name: "chain-cosmos-amino",
		createSigner: async () => {
			const wallet = await Secp256k1Wallet.fromKey(secp256k1.utils.randomPrivateKey())

			return new CosmosSigner({
				signer: {
					type: "amino",
					getAddress: async () => (await wallet.getAccounts())[0].address,
					getChainId: async () => "cosmos",
					signAmino: async (chainId: string, signer: string, signDoc: StdSignDoc) => {
						return wallet.signAmino(signer, signDoc)
					},
				},
			})
		},
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
		name: "chain-ethereum-viem",
		createSigner: async () => new SIWESignerViem(),
	},
	{
		name: "chain-ethereum-eip712",
		createSigner: async () => new Eip712Signer(),
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

	test(`${name} - create and verify session fails on incorrect signature`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()

		const session = await signer.getSession(topic)
		// tamper with the session
		session.timestamp = 0
		try {
			await signer.verifySession(topic, session)
			t.fail("expected verifySession to throw")
		} catch (e) {
			t.pass()
		}
	})

	test(`${name} - sign session and verify session signature`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()

		const session = await signer.getSession(topic)

		const message: Message<Session> = { topic, clock: 0, parents: [], payload: session }
		const sessionSignature = await signer.sign(message)
		t.notThrows(() => signer.verify(sessionSignature, message))
	})

	test(`${name} - session address is matched by the signer`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()

		const session = await signer.getSession(topic)
		const addressParts = session.address.split(":")
		t.is(addressParts.length, 3)
		t.true(signer.match(session.address))
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

	test(`${name} - create and verify session and action`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()
		const session = await signer.getSession(topic)
		t.notThrows(() => signer.verifySession(topic, session))

		const sessionMessage = { topic, clock: 1, parents: [], payload: session }
		const sessionSignature = await signer.sign(sessionMessage)
		t.notThrows(() => signer.verify(sessionSignature, sessionMessage))

		const action: Action = {
			type: "action",
			address: session.address,
			name: "foo",
			args: { bar: 7 },
			blockhash: null,
			timestamp: session.timestamp,
		}

		const actionMessage = { topic, clock: 1, parents: [], payload: action }
		const actionSignature = await signer.sign(actionMessage)
		t.notThrows(() => signer.verify(actionSignature, actionMessage))
	})
}

for (const implementation of SIGNER_IMPLEMENTATIONS) {
	runTestSuite(implementation)
}

test(`ethereum - ethers signer can verify ethereum viem signed data`, async (t) => {
	const topic = "example:signer"
	const signingSigner = new SIWESignerViem()
	const verifyingSigner = new SIWESigner()

	const session = await signingSigner.getSession(topic)
	await t.notThrowsAsync(() => Promise.resolve(verifyingSigner.verifySession(topic, session)))
})

test(`ethereum - viem signer can verify ethers signed data`, async (t) => {
	const topic = "example:signer"
	const signingSigner = new SIWESigner()
	const verifyingSigner = new SIWESignerViem()

	const session = await signingSigner.getSession(topic)
	await t.notThrowsAsync(() => Promise.resolve(verifyingSigner.verifySession(topic, session)))
})
