import { Wallet } from "ethers"
import { WalletMock } from "@canvas-js/interfaces"
import { EthereumChainImplementation } from "./implementation.js"

export class EthereumWalletMock implements WalletMock<EthereumChainImplementation> {
	createSigner() {
		return Wallet.createRandom()
	}
}
