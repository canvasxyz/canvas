import test from "ava"
import { ActionPayload, ChainImplementation, SessionPayload } from "@canvas-js/interfaces"
import { createMockEthereumSigner, EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { createMockSolanaSigner, SolanaChainImplementation } from "@canvas-js/chain-solana"
import { createMockSubstrateSigner, SubstrateChainImplementation } from "@canvas-js/chain-substrate"

interface MockedImplementation<CI extends ChainImplementation> {
	implementationName: string
	chainImplementation: CI
	createMockSigner: () => CI extends ChainImplementation<infer Signer, any> ? Signer : never
}

const IMPLEMENTATIONS = [
	{
		implementationName: "ethereum",
		chainImplementation: new EthereumChainImplementation(),
		createMockSigner: createMockEthereumSigner,
	},
	{
		implementationName: "solana",
		chainImplementation: new SolanaChainImplementation(),
		createMockSigner: createMockSolanaSigner,
	},
	{
		implementationName: "substrate",
		chainImplementation: new SubstrateChainImplementation(),
		createMockSigner: createMockSubstrateSigner,
	},
] as MockedImplementation<any>[]

for (const testCase of IMPLEMENTATIONS) {
	runTestSuite(testCase)
}

function runTestSuite<T extends ChainImplementation<S, any>, S>({
	chainImplementation,
	implementationName,
	createMockSigner,
}: MockedImplementation<T>) {
	test(`${implementationName} Sign and verify a session successfully`, async (t) => {
		const signer = createMockSigner()

		const from = await chainImplementation.getSignerAddress(signer)
		const delegatedSigner = await chainImplementation.generateDelegatedSigner()
		const sessionAddress = await chainImplementation.getDelegatedSignerAddress(delegatedSigner)

		const sessionPayload = {
			app: "ipfs://...",
			appName: "Canvas",
			block: "any block value",
			chain: chainImplementation.chain,
			chainId: chainImplementation.chainId,
			from,
			sessionAddress,
			sessionDuration: 1,
			sessionIssued: 1,
		} as SessionPayload

		let out = await chainImplementation.signSession(signer, sessionPayload)
		t.notThrows(async () => {
			await chainImplementation.verifySession(out)
		})
	})

	test(`${implementationName} Verifying a session fails if "from" value is incorrect`, async (t) => {
		const signer = createMockSigner()

		const delegatedSigner = await chainImplementation.generateDelegatedSigner()
		const from = await chainImplementation.getSignerAddress(signer)
		const sessionAddress = await chainImplementation.getDelegatedSignerAddress(delegatedSigner)

		const sessionPayload = {
			app: "ipfs://...",
			appName: "Canvas",
			block: "any block value",
			chain: chainImplementation.chain,
			chainId: chainImplementation.chainId,
			from,
			sessionAddress,
			sessionDuration: 1,
			sessionIssued: 1,
		} as SessionPayload

		let out = await chainImplementation.signSession(signer, sessionPayload)
		out.payload.from = "other address"
		await t.throwsAsync(async () => {
			await chainImplementation.verifySession(out)
		})
	})

	test(`${implementationName} Directly sign an action successfully`, async (t) => {
		const signer = createMockSigner()

		const from = await chainImplementation.getSignerAddress(signer)

		const actionPayload: ActionPayload = {
			app: "ipfs://...",
			appName: "Canvas",
			from,
			call: "doSomething",
			callArgs: {},
			block: "any block value",
			chain: chainImplementation.chain,
			chainId: chainImplementation.chainId,
			timestamp: 10000000,
		}
		const out = await chainImplementation.signAction(signer, actionPayload)
		t.notThrows(async () => {
			await chainImplementation.verifyAction(out)
		})
	})

	test(`${implementationName} Verifying an invalid direct signature fails if "from" value is incorrect`, async (t) => {
		const signer = createMockSigner()

		const from = await chainImplementation.getSignerAddress(signer)

		const actionPayload: ActionPayload = {
			app: "ipfs://...",
			appName: "Canvas",
			from,
			call: "doSomething",
			callArgs: {},
			block: "any block value",
			chain: chainImplementation.chain,
			chainId: chainImplementation.chainId,
			timestamp: 10000000,
		}
		let out = await chainImplementation.signAction(signer, actionPayload)
		out.payload.from = "something else "
		await t.throwsAsync(async () => {
			await chainImplementation.verifyAction(out)
		})
	})

	test(`${implementationName} Sign an action successfully with delegated signer`, async (t) => {
		const signer = createMockSigner()

		const delegatedSigner = await chainImplementation.generateDelegatedSigner()
		const from = await chainImplementation.getSignerAddress(signer)

		const actionPayload: ActionPayload = {
			app: "ipfs://...",
			appName: "Canvas",
			from,
			call: "doSomething",
			callArgs: {},
			block: "any block value",
			chain: chainImplementation.chain,
			chainId: chainImplementation.chainId,
			timestamp: 10000000,
		}
		const out = await chainImplementation.signDelegatedAction(delegatedSigner, actionPayload)
		t.notThrows(async () => {
			await chainImplementation.verifyAction(out)
		})
	})
}
