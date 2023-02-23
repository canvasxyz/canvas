import { ethers } from "ethers"

export function createMockEthereumSigner(): ethers.Signer {
	return ethers.Wallet.createRandom()
}
