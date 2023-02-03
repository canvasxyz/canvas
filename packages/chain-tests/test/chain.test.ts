import test from "ava"
import { ChainImplementation, SessionPayload } from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"
import { EthereumWalletMock, SolanaMock, WalletMock } from "./mocks.js"
import { SolanaChainImplementation } from "@canvas-js/chain-solana"

interface Implementation<CI extends ChainImplementation> {
	implementationName: string
	chainImplementation: CI
	mock: WalletMock<CI>
}

const IMPLEMENTATIONS = [
	{
		implementationName: "ethereum",
		chainImplementation: new EthereumChainImplementation(),
		mock: new EthereumWalletMock(),
	},
	{
		implementationName: "solana",
		chainImplementation: new SolanaChainImplementation(),
		mock: new SolanaMock(),
	},
] as Implementation<any>[]

for (const { implementationName, chainImplementation, mock } of IMPLEMENTATIONS) {
	test(`${implementationName} Sign a session successfully`, async (t) => {
		const signer = mock.createSigner()

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

	test(`${implementationName} Signing a session fails if "from" value is incorrect`, async (t) => {
		const signer = mock.createSigner()

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
}
