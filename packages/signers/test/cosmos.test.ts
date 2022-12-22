import test from "ava"
import { Secp256k1HdWallet } from "@cosmjs/amino"
import { CosmosActionSigner } from "@canvas-js/signers"
import { ActionPayload } from "@canvas-js/interfaces"
import { verifyActionSignature } from "@canvas-js/verifiers"

test("Sign an action for Cosmos", async (t) => {
	const bech32Prefix = "osmo"

	const wallet = await Secp256k1HdWallet.generate()
	const sessionAddress = (await wallet.getAccounts())[0].address

	const actionSignerWallet = await Secp256k1HdWallet.generate()
	const actionSignerCosmosAddress = (await actionSignerWallet.getAccounts())[0].address

	const actionSigner = new CosmosActionSigner(actionSignerWallet, actionSignerCosmosAddress, "osmo")

	const payload = {
		from: sessionAddress,
		spec: "ipfs://something.spec.js",
		call: "post",
		args: { title: "Hello world!", text: "Lorem ipsum dolor sit amet" },
		timestamp: 123456789,
		blocknum: 123456789,
		blockhash: "0x123456789",
		chain: "cosmos",
		chainId: "osmosis-1",
	} as ActionPayload

	const action = await actionSigner.signActionPayload(payload)
	const recoveredAddress = await verifyActionSignature(action)
	t.deepEqual(recoveredAddress, actionSigner.address.toLowerCase())
})
