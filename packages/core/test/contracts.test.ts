import test from "ava"

import * as dotenv from "dotenv"
import { ethers } from "ethers"

import { Action, ActionArgument, ActionPayload } from "@canvas-js/interfaces"
import { getActionSignatureData } from "@canvas-js/verifiers"
import { compileSpec, Core } from "@canvas-js/core"
import { EthereumBlockProvider } from "@canvas-js/signers"

dotenv.config({ path: "../../.env" })

const { ETH_CHAIN_ID, ETH_CHAIN_RPC } = process.env

const signer = ethers.Wallet.createRandom()
const signerAddress = signer.address.toLowerCase()

test("Test calling the public ENS resolver contract", async (t) => {
	if (ETH_CHAIN_ID === undefined || ETH_CHAIN_RPC === undefined) {
		t.log("ETH_CHAIN_ID and ETH_CHAIN_RPC not found. Skipping contract tests.")
		t.pass()
		return
	}

	const { uri, spec } = await compileSpec({
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
				chain: "eth",
				chainId: 1,
				address: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
				abi: ["function balanceOf(address owner) view returns (uint balance)"],
			},
		},
	})

	const provider = new EthereumBlockProvider(ETH_CHAIN_ID, ETH_CHAIN_RPC)
	const providers = { [`eth:${ETH_CHAIN_ID}`]: provider }
	const core = await Core.initialize({ directory: null, uri, spec, providers, offline: true })

	async function sign(call: string, args: Record<string, ActionArgument>): Promise<Action> {
		const timestamp = Date.now()
		const block = await provider.getBlock("latest")
		const actionPayload: ActionPayload = {
			from: signerAddress,
			spec: uri,
			call,
			args,
			timestamp,
			chain: "eth",
			chainId: 1,
			blocknum: block.blocknum,
			blockhash: block.blockhash,
		}
		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await signer._signTypedData(...actionSignatureData)

		return { type: "action", payload: actionPayload, session: null, signature: actionSignature }
	}

	const action = await sign("verify", {})
	await t.throwsAsync(core.applyAction(action), { message: "balance is zero!" })
	await core.close()
})
