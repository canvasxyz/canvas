import test from "ava"
import { ChainImplementation, SessionPayload, WalletMock } from "@canvas-js/interfaces"
import { EthereumChainImplementation, EthereumWalletMock } from "@canvas-js/chain-ethereum"
import { SolanaChainImplementation, SolanaWalletMock } from "@canvas-js/chain-solana"
import { SubstrateChainImplementation, SubstrateWalletMock } from "@canvas-js/chain-substrate"

interface MockedImplementation<CI extends ChainImplementation> {
	implementationName: string
	chainImplementation: CI
	walletMock: WalletMock<CI>
}

const IMPLEMENTATIONS = [
	{
		implementationName: "ethereum",
		chainImplementation: new EthereumChainImplementation(),
		walletMock: new EthereumWalletMock(),
	},
	{
		implementationName: "solana",
		chainImplementation: new SolanaChainImplementation(),
		walletMock: new SolanaWalletMock(),
	},
	{
		implementationName: "substrate",
		chainImplementation: new SubstrateChainImplementation(),
		walletMock: new SubstrateWalletMock(),
	},
] as MockedImplementation<any>[]

for (const { implementationName, chainImplementation, walletMock } of IMPLEMENTATIONS) {
	test(`${implementationName} Sign a session successfully`, async (t) => {
		const signer = walletMock.createSigner()

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
		const signer = walletMock.createSigner()

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
