import test from "ava"
import { SIWESigner } from "@canvas-js/chain-ethereum"
import { SolanaSigner } from "@canvas-js/chain-solana"
import { Action, ActionContext, Message, Signer } from "@canvas-js/interfaces"

type MockedImplementation = { createSigner: () => Promise<Signer>; name: string }
const SIGNER_IMPLEMENTATIONS: MockedImplementation[] = [
	{
		name: "ethereum",
		createSigner: async () => SIWESigner.init({}),
	},
	{
		name: "solana",
		createSigner: async () => SolanaSigner.initWithKeypair(),
	},
]

export const getActionContext = (topic: string): ActionContext => ({
	topic,
	timestamp: Date.now(),
	blockhash: null,
	// depth: 0,
	// dependencies: [],
})

function runTestSuite({ createSigner, name }: MockedImplementation) {
	test(`${name} - create and verify action`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()
		const action = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
		const message = { clock: 0, parents: [], payload: action } satisfies Message<Action>
		const signature = signer.sign(message)
		await signer.verify(signature, message)
		t.pass()
	})

	test(`${name} - verification fails for the wrong message`, async (t) => {
		const topic = "example:signer"
		const signer = await createSigner()
		const action_1 = signer.create("foo", { bar: 7 }, getActionContext(topic), {})
		const message_1 = { clock: 0, parents: [], payload: action_1 } satisfies Message<Action>

		const action_2 = signer.create("baz", { qux: 7 }, getActionContext(topic), {})
		const message_2 = { clock: 0, parents: [], payload: action_2 } satisfies Message<Action>

		const signature_1 = signer.sign(message_1)
		await t.throwsAsync(async () => {
			await signer.verify(signature_1, message_2)
		})

		const signature_2 = signer.sign(message_2)
		await t.throwsAsync(async () => {
			await signer.verify(signature_2, message_1)
		})
	})

	test(`${name} - verification fails for the wrong signer`, async (t) => {
		const topic = "example:signer"
		const signer_1 = await createSigner()
		const signer_2 = await createSigner()

		const action_1 = signer_1.create("foo", { bar: 7 }, getActionContext(topic), {})
		const message_1 = { clock: 0, parents: [], payload: action_1 } satisfies Message<Action>

		const action_2 = signer_2.create("baz", { qux: 7 }, getActionContext(topic), {})
		const message_2 = { clock: 0, parents: [], payload: action_2 } satisfies Message<Action>

		const signature_1 = signer_1.sign(message_1)
		await t.throwsAsync(async () => {
			await signer_2.verify(signature_1, message_2)
		})

		const signature_2 = signer_2.sign(message_2)
		await t.throwsAsync(async () => {
			await signer_1.verify(signature_2, message_1)
		})
	})
}

for (const mockImplementation of SIGNER_IMPLEMENTATIONS) {
	runTestSuite(mockImplementation)
}
