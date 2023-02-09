import { ethers } from "ethers"
import { EvmMetaMaskSigner } from "./signerInterface.js"

export async function createMockEvmosSigner(): Promise<EvmMetaMaskSigner> {
	const wallet = ethers.Wallet.createRandom()
	return {
		eth: {
			personal: {
				sign: async (dataToSign: string, address: string, password: string) => {
					return wallet.signMessage(dataToSign)
				},
			},
			getAccounts: async () => {
				return [wallet.address]
			},
		},
	}
}
