import test from "ava"

import { ethers } from "ethers"

import { ActionArgument, getActionSignatureData } from "@canvas-js/interfaces"
import { compileSpec, Core } from "@canvas-js/core"

const signer = ethers.Wallet.createRandom()
const signerAddress = signer.address.toLowerCase()

const { spec, uri } = await compileSpec({
	models: {},
	actions: {
		async logIP() {
			const res = await fetch("https://ipv4.icanhazip.com/")
			console.log("my IP address is", res)
		},
	},
})

async function sign(signer: ethers.Wallet, session: string | null, call: string, args: ActionArgument[]) {
	const timestamp = Date.now()
	const actionPayload = { from: signerAddress, spec: uri, call, args, timestamp }
	const actionSignatureData = getActionSignatureData(actionPayload)
	const actionSignature = await signer._signTypedData(...actionSignatureData)
	return { payload: actionPayload, session, signature: actionSignature }
}

test("test fetch and log IP address", async (t) => {
	const core = await Core.initialize({ uri, spec, directory: null, unchecked: true, offline: true })

	const action = await sign(signer, null, "logIP", [])
	await core.applyAction(action)
	await core.close()

	t.pass()
})
