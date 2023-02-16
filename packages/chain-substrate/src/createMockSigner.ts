import { Keyring } from "@polkadot/api"
import type { InjectedExtension } from "@polkadot/extension-inject/types"
import { mnemonicGenerate } from "@polkadot/util-crypto"

export function createMockSubstrateSigner(): { extension: InjectedExtension; address: string } {
	const keyring: Keyring = new Keyring({ ss58Format: 42 })
	const mnemonic = mnemonicGenerate()
	const pair = keyring.addFromUri(mnemonic, {}) // use sr25519 by default

	return {
		extension: {
			name: "",
			version: "",
			accounts: {
				get: async () => [],
				subscribe: (cb) => () => {},
			},
			signer: {
				signRaw: async ({ data }: { data: string }) => {
					const signatureBytes = pair.sign(data)
					const signature = Buffer.from(signatureBytes).toString("hex")
					return { id: 0, signature: `0x${signature}` }
				},
			},
		},
		address: pair.address,
	}
}
