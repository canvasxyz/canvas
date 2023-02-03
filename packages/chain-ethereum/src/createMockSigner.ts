import { Wallet } from "ethers"

export function createMockEthereumSigner() {
	return Wallet.createRandom()
}
