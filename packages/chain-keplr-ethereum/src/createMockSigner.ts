import { ethers } from "ethers"
import { arrayify } from "ethers/lib/utils.js"
import { KeplrEthereumSigner } from "./signerInterface.js"

export async function createMockKeplrEthereumSigner(): Promise<KeplrEthereumSigner> {
	const wallet = ethers.Wallet.createRandom()
	return {
		getOfflineSigner: () => ({
			getAccounts: () => [
				{
					address: wallet.address,
					algo: "secp256k1",
					pubkey: arrayify(wallet.publicKey),
				},
			],
		}),
		signEthereum: async (chainId: string, address: string, dataToSign: string, ethSignType) => {
			const signatureStr = await wallet.signMessage(dataToSign)
			return arrayify(signatureStr)
		},
	}
}
