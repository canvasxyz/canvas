import test from "ava"

import * as dotenv from "dotenv"
import { ethers } from "ethers"

import { getQuickJS } from "quickjs-emscripten"

import { Action, ActionArgument, ActionPayload, getActionSignatureData } from "@canvas-js/interfaces"
import { Core, compileSpec } from "@canvas-js/core"

import { getCurrentBlock } from "./utils.js"

dotenv.config({ path: "../../.env" })

const { ETH_CHAIN_ID, ETH_CHAIN_RPC } = process.env

const quickJS = await getQuickJS()

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
			async verify() {
				const [balance] = await this.contracts.milady.balanceOf(this.from)
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

	const rpc = { eth: { [ETH_CHAIN_ID]: ETH_CHAIN_RPC } }
	const core = await Core.initialize({ uri, directory: null, spec, quickJS, rpc })
	const provider = core.getProvider("eth", ETH_CHAIN_ID)

	async function sign(call: string, args: ActionArgument[]): Promise<Action> {
		const timestamp = Date.now()
		const block = await getCurrentBlock(provider)
		const actionPayload: ActionPayload = { from: signerAddress, spec: uri, call, args, timestamp, block }
		const actionSignatureData = getActionSignatureData(actionPayload)
		const actionSignature = await signer._signTypedData(...actionSignatureData)

		return { payload: actionPayload, session: null, signature: actionSignature }
	}

	const action = await sign("verify", [])
	await t.throwsAsync(core.applyAction(action), { message: "balance is zero!" })
	await core.close()
})
