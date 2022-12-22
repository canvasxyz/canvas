import test from "ava"
import { ethers } from "ethers"
import type { ActionPayload } from "@canvas-js/interfaces"
import { EthereumActionSigner } from "@canvas-js/signers"
import { verifyActionSignature } from "@canvas-js/verifiers"

test("Sign an action for ethereum", async (t) => {
	const sessionWallet = ethers.Wallet.createRandom()

	const ethersWallet = ethers.Wallet.createRandom()
	const wallet = new EthereumActionSigner(ethersWallet)

	const payload: ActionPayload = {
		from: sessionWallet.address,
		spec: "ipfs://something.spec.js",
		call: "post",
		args: { title: "Hello world!", text: "Lorem ipsum dolor sit amet" },
		timestamp: 123456789,
		blockhash: "0x123456789",
		chain: "eth",
		chainId: 1,
	}

	const action = await wallet.signActionPayload(payload)

	const recoveredAddress = await verifyActionSignature(action)
	t.deepEqual(recoveredAddress, ethersWallet.address.toLowerCase())
})
