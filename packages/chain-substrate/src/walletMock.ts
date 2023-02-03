import { Keyring } from "@polkadot/api"
import { mnemonicGenerate } from "@polkadot/util-crypto"
import { WalletMock } from "@canvas-js/interfaces"
import { SubstrateChainImplementation } from "./implementation.js"

export class SubstrateWalletMock implements WalletMock<SubstrateChainImplementation> {
	createSigner() {
		const keyring: Keyring = new Keyring({ ss58Format: 42 })
		const mnemonic = mnemonicGenerate()
		const pair = keyring.addFromUri(mnemonic, {}) // use sr25519 by default

		return {
			extension: {
				name: "",
				version: "",
				accounts: {
					get: async () => [],
					subscribe: (cb: any) => () => {},
				},
				signer: {
					signRaw: async ({ data }: { data: string }) => {
						const signatureBytes = pair.sign(data)
						const signature = Buffer.from(signatureBytes).toString("hex")
						return { id: 0, signature: `0x${signature}` as `0x${string}` }
					},
				},
			},
			address: pair.address,
		}
	}
}
