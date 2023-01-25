import test from "ava"
import { ethers } from "ethers"
import type { ActionPayload } from "@canvas-js/interfaces"
import { EthereumActionSigner } from "@canvas-js/signers"
import { ethereumVerifier } from "@canvas-js/chain-ethereum"

test("Sign an action for ethereum", async (t) => {
	const parentWallet = ethers.Wallet.createRandom()

	const childWallet = ethers.Wallet.createRandom()
	const signer = new EthereumActionSigner(childWallet)

	const appName = "Test App"
	const payload: ActionPayload = {
		from: parentWallet.address,
		app: "ipfs://something.spec.js",
		appName: "Test App",
		call: "post",
		callArgs: { title: "Hello world!", text: "Lorem ipsum dolor sit amet" },
		timestamp: 123456789,
		block: "0x123456789",
		chain: "ethereum",
		chainId: "1",
	}

	const action = await signer.signActionPayload(payload)
	await ethereumVerifier.verifyAction(action)
})
