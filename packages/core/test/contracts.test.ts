import test from "ava"

import * as dotenv from "dotenv"

import { compileSpec, Core } from "@canvas-js/core"
import { EthereumBlockProvider } from "@canvas-js/verifiers"
import { TestSigner } from "./utils.js"

dotenv.config({ path: "../../.env" })

const { ETH_CHAIN_ID, ETH_CHAIN_RPC } = process.env

test("contracts (milady balanceOf)", async (t) => {
	if (ETH_CHAIN_ID === undefined || ETH_CHAIN_RPC === undefined) {
		t.log("ETH_CHAIN_ID and ETH_CHAIN_RPC not found. Skipping contract tests.")
		t.pass()
		return
	}

	const { app, spec, appName } = await compileSpec({
		name: "Test App",
		models: {},
		actions: {
			async verify({}, { contracts, from }) {
				const [balance] = await contracts.milady.balanceOf(from)
				if (balance === 0) {
					throw new Error("balance is zero!")
				}
			},
		},
		contracts: {
			milady: {
				chain: "ethereum",
				chainId: "1",
				address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
				abi: ["function balanceOf(address owner) view returns (uint balance)"],
			},
		},
	})

	const provider = new EthereumBlockProvider(ETH_CHAIN_ID, ETH_CHAIN_RPC)
	const providers = { [`ethereum:${ETH_CHAIN_ID}`]: provider }
	const core = await Core.initialize({ spec, directory: null, libp2p: null, providers })

	const signer = new TestSigner(app, appName, provider)

	const action = await signer.sign("verify", {})
	await t.throwsAsync(core.applyAction(action), { message: "balance is zero!" })

	await core.close()
})
