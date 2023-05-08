import test from "ava"

import { Core } from "@canvas-js/core"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import { compileSpec, TestSigner } from "./utils.js"

test("multiple chains export", async (t) => {
	const { spec } = await compileSpec({
		chains: ["eip155:1", "eip155:100"],
		models: {},
		actions: { foo: async ({}, {}) => {} },
	})

	const [mainnet, gnosis] = [new EthereumChainImplementation(1), new EthereumChainImplementation(0x64)]
	const core = await Core.initialize({
		chains: [mainnet, gnosis],
		spec,
		directory: null,
		offline: true,
	})

	t.teardown(() => core.close())

	const mainnetSigner = new TestSigner(core.app, mainnet)
	const gnosisSigner = new TestSigner(core.app, gnosis)

	await t.notThrowsAsync(async () => {
		const action = await mainnetSigner.sign("foo", {})
		await core.apply(action)
	})

	await t.notThrowsAsync(async () => {
		const action = await gnosisSigner.sign("foo", {})
		await core.apply(action)
	})
})

test("missing signer declaration for provided chain implementation", async (t) => {
	const { spec } = await compileSpec({
		chains: ["eip155:1"],
		models: {},
		actions: { foo: async ({}, {}) => {} },
	})

	const [mainnet, gnosis] = [new EthereumChainImplementation(1), new EthereumChainImplementation(0x64)]
	await t.throwsAsync(
		async () => {
			const core = await Core.initialize({
				chains: [mainnet, gnosis],
				spec,
				directory: null,
				offline: true,
			})
		},
		{ message: "ipfs://QmPrP7ZVTKSkoNtpfr24XH1UNqSugEDNSqY9BGV7hE8SF9 contract didn't declare a signer for eip155:100" }
	)
})

test("missing chain implementation", async (t) => {
	const { app, spec } = await compileSpec({
		chains: ["eip155:1", "eip155:100"],
		models: {},
		actions: { foo: async ({}, {}) => {} },
	})

	await t.throwsAsync(
		Core.initialize({
			chains: [new EthereumChainImplementation(1)],
			spec,
			directory: null,
			offline: true,
		}),
		{ message: `${app} requires a chain implementation for eip155:100` }
	)
})
