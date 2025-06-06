import test from "ava"

import { Secp256k1Wallet, StdSignDoc } from "@cosmjs/amino"
import { secp256k1 } from "@noble/curves/secp256k1"

import { Action, DidIdentifier, Message, Session, SessionSigner, Signer } from "@canvas-js/interfaces"

// import { ATPSigner } from "@canvas-js/signer-atp"
import { CosmosSigner } from "@canvas-js/signer-cosmos"
import { SIWESigner, Eip712Signer } from "@canvas-js/signer-ethereum"
import { SIWESignerViem } from "@canvas-js/signer-ethereum-viem"
import { SolanaSigner } from "@canvas-js/signer-solana"
import { SubstrateSigner } from "@canvas-js/signer-substrate"

type AdditionalSignerArgs = {
	sessionDuration?: number
}

type SessionSignerImplementation = {
	createSessionSigner: (args?: AdditionalSignerArgs) => Promise<SessionSigner<any>>
	name: string
}

const SIGNER_IMPLEMENTATIONS: SessionSignerImplementation[] = [
	{
		name: "signer-cosmos",
		createSessionSigner: async (args) => new CosmosSigner(args),
	},
	{
		name: "signer-cosmos-amino",
		createSessionSigner: async (args) => {
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
				...args,
			})
		},
	},
	{
		name: "signer-ethereum",
		createSessionSigner: async (args) => new SIWESigner({ ...args, burner: true }),
	},
	{
		name: "signer-ethereum-viem",
		createSessionSigner: async (args) => new SIWESignerViem({ ...args, burner: true }),
	},
	{
		name: "signer-ethereum-eip712",
		createSessionSigner: async (args) => new Eip712Signer({ ...args, burner: true }),
	},
	{
		name: "signer-solana",
		createSessionSigner: async (args) => new SolanaSigner(args),
	},
	{
		name: "signer-substrate-sr25519",
		createSessionSigner: async (args) => new SubstrateSigner({ substrateKeyType: "sr25519", ...args }),
	},
	{
		name: "signer-substrate-ed25519",
		createSessionSigner: async (args) => new SubstrateSigner({ substrateKeyType: "ed25519", ...args }),
	},
	{
		name: "signer-substrate-ecdsa",
		createSessionSigner: async (args) => new SubstrateSigner({ substrateKeyType: "ecdsa", ...args }),
	},
	{
		name: "signer-substrate-ethereum",
		createSessionSigner: async (args) => new SubstrateSigner({ substrateKeyType: "ethereum", ...args }),
	},
]

function runTestSuite({ createSessionSigner: createSessionSigner, name }: SessionSignerImplementation) {
	test(`${name} - create and verify session`, async (t) => {
		const topic = "com.example.app"
		const sessionSigner = await createSessionSigner()
		t.assert(sessionSigner.listAllSessions(topic).length === 0)
		const { payload: session } = await sessionSigner.newSession(topic)
		t.assert(sessionSigner.listAllSessions(topic).length > 0)
		t.assert(sessionSigner.listAllSessions(topic, await sessionSigner.getDid()).length === 1)
		t.assert(
			sessionSigner.listAllSessions(topic, "did:pkh:eip155:1:0x8A876c44064b77b36Cb3e0524DeeC1416858bDE6").length === 0,
		)
		await t.notThrowsAsync(() => Promise.resolve(sessionSigner.verifySession(topic, session)))
	})

	test(`${name} - create and verify session with a session duration`, async (t) => {
		const topic = "com.example.app"
		const duration = 1000 * 60 * 60 * 24 * 7
		const sessionSigner = await createSessionSigner({ sessionDuration: duration })
		const { payload: session } = await sessionSigner.newSession(topic)
		t.is(session.context.duration, duration)
		await t.notThrowsAsync(() => Promise.resolve(sessionSigner.verifySession(topic, session)))
	})

	test(`${name} - create and verify session with no session duration given`, async (t) => {
		const topic = "com.example.app"
		const sessionSigner = await createSessionSigner({})
		const { payload: session } = await sessionSigner.newSession(topic)
		// if no sessionDuration is given, the session duration should be undefined
		t.is(session.context.duration, undefined)
		await t.notThrowsAsync(() => Promise.resolve(sessionSigner.verifySession(topic, session)))
	})

	test(`${name} - create and verify session fails on incorrect signature`, async (t) => {
		const topic = "com.example.app"
		const sessionSigner = await createSessionSigner()

		const { payload: session } = await sessionSigner.newSession(topic)
		// tamper with the session
		session.context.timestamp = 0
		try {
			await sessionSigner.verifySession(topic, session)
			t.fail("expected verifySession to throw")
		} catch (e) {
			t.pass()
		}
	})

	test(`${name} - sign session and verify session signature`, async (t) => {
		const topic = "com.example.app"
		const sessionSigner = await createSessionSigner()

		const { payload: session, signer: delegateSigner } = await sessionSigner.newSession(topic)

		const message: Message<Session> = { topic, clock: 0, parents: [], payload: session }
		const sessionSignature = await delegateSigner.sign(message)
		t.notThrows(() => sessionSigner.scheme.verify(sessionSignature, message))
	})

	test(`${name} - session address is matched by the signer`, async (t) => {
		const topic = "com.example.app"
		const sessionSigner = await createSessionSigner()

		const { payload: session } = await sessionSigner.newSession(topic)
		t.is(session.did.split(":").length, sessionSigner.getDidParts())
		t.true(sessionSigner.match(session.did))
	})

	// test(`${name} - refuse to sign foreign sessions`, async (t) => {
	// 	const topic = "com.example.app"
	// 	const [a, b] = await Promise.all([createSigner(), createSigner()])

	// 	const sessionA = await a.getSession(topic)
	// 	const sessionB = await b.getSession(topic)

	// 	await t.notThrowsAsync(async () => a.sign({ topic, clock: 0, parents: [], payload: sessionA }))
	// 	await t.notThrowsAsync(async () => b.sign({ topic, clock: 0, parents: [], payload: sessionB }))
	// 	await t.throwsAsync(async () => a.sign({ topic, clock: 0, parents: [], payload: sessionB }))
	// 	await t.throwsAsync(async () => b.sign({ topic, clock: 0, parents: [], payload: sessionA }))
	// })

	test(`${name} - different signers successfully verify each other's sessions`, async (t) => {
		const topic = "com.example.app"
		const [a, b] = await Promise.all([createSessionSigner(), createSessionSigner()])

		const { payload: sessionA } = await a.newSession(topic)
		const { payload: sessionB } = await b.newSession(topic)

		await t.notThrowsAsync(async () => a.verifySession(topic, sessionB))
		await t.notThrowsAsync(async () => b.verifySession(topic, sessionA))
	})

	test(`${name} - create and verify session and action`, async (t) => {
		const topic = "com.example.app"
		const sessionSigner = await createSessionSigner()
		const { payload: session, signer: delegateSigner } = await sessionSigner.newSession(topic)
		t.notThrows(() => sessionSigner.verifySession(topic, session))

		const sessionMessage = { topic, clock: 1, parents: [], payload: session }
		const sessionSignature = await delegateSigner.sign(sessionMessage)
		t.notThrows(() => delegateSigner.scheme.verify(sessionSignature, sessionMessage))

		const action: Action = {
			type: "action",
			did: session.did,
			name: "foo",
			args: [7],
			context: {
				timestamp: session.context.timestamp,
			},
		}

		const actionMessage = { topic, clock: 1, parents: [], payload: action }
		const actionSignature = await delegateSigner.sign(actionMessage)
		t.notThrows(() => delegateSigner.scheme.verify(actionSignature, actionMessage))
	})
}

for (const implementation of SIGNER_IMPLEMENTATIONS) {
	runTestSuite(implementation)
}

test(`ethereum - ethers signer can verify ethereum viem signed data`, async (t) => {
	const topic = "com.example.app"
	const signingSigner = new SIWESignerViem({ burner: true })
	const verifyingSigner = new SIWESigner({ readOnly: true })

	const { payload: session } = await signingSigner.newSession(topic)
	await t.notThrowsAsync(() => Promise.resolve(verifyingSigner.verifySession(topic, session)))
})

test(`ethereum - viem signer can verify ethers signed data`, async (t) => {
	const topic = "com.example.app"
	const signingSigner = new SIWESigner({ burner: true })
	const verifyingSigner = new SIWESignerViem()

	const { payload: session } = await signingSigner.newSession(topic)
	await t.notThrowsAsync(() => Promise.resolve(verifyingSigner.verifySession(topic, session)))
})
