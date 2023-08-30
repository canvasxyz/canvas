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
}

for (const mockImplementation of SIGNER_IMPLEMENTATIONS) {
	runTestSuite(mockImplementation)
}
