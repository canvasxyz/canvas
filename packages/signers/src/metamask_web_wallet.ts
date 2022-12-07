import { ethers } from "ethers"
import { Action, ActionPayload, Block, Chain, ChainId, Session, SessionPayload } from "@canvas-js/interfaces"
import { Connector, SessionSigner, ActionSigner } from "./interfaces.js"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/verifiers"

export class MetaMaskEthereumConnector implements Connector {
	chain: Chain = "eth"
	provider: ethers.providers.Web3Provider
	onAccountsChanged?: (accounts: string[]) => void
	onNetwork?: (newNetwork: any, oldNetwork: any) => void

	constructor() {
		// enable
		// default to ETH
		// The "any" network will allow spontaneous network changes
		const ethereum = (window as any).ethereum
		this.provider = new ethers.providers.Web3Provider(ethereum, "any")
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }) {
		this.onNetwork = (newNetwork, oldNetwork) => {
			// Force page refreshes on network changes, see https://docs.ethers.io/v5/concepts/best-practices/
			// When a Provider makes its initial connection, it emits a "network"
			// event with a null oldNetwork along with the newNetwork. So, if the
			// oldNetwork exists, it represents a changing network
			if (oldNetwork) {
				window.location.reload()
			}
		}
		this.provider.on("network", this.onNetwork)

		const ethereum = (window as any).ethereum

		// this is not abstracted away by ethers
		this.onAccountsChanged = onAccountsChanged
		ethereum.on("accountsChanged", onAccountsChanged)

		// TODO: use https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods to switch active
		// chain according to currently active node, if one exists
		console.log("Attempting to enable Metamask")

		const accounts: string[] = await this.provider.send("eth_requestAccounts", [])
		onAccountsChanged(accounts)
	}

	async disable() {
		if (this.onNetwork) {
			this.provider.removeListener("network", this.onNetwork)
		}
		if (this.onAccountsChanged) {
			const ethereum = (window as any).ethereum
			ethereum.removeListener("accountsChanged", this.onAccountsChanged)
		}
	}

	async createSessionSigner(account: string): Promise<SessionSigner> {
		const providerSigner = this.provider.getSigner(account)
		// if the network changes, we will throw away this Signer
		const network = await this.provider.getNetwork()
		return new MetaMaskEthereumSigner(providerSigner, network)
	}
}

export class MetaMaskEthereumSigner implements SessionSigner {
	chain: Chain = "eth"
	signer: ethers.providers.JsonRpcSigner
	network: ethers.providers.Network

	constructor(signer: ethers.providers.JsonRpcSigner, network: ethers.providers.Network) {
		this.signer = signer
		this.network = network
	}

	async getRecentBlock(): Promise<Block> {
		const { provider } = this.signer
		const providerBlock = await provider.getBlock("latest")

		return {
			chain: this.chain,
			chainId: this.network.chainId,
			blocknum: providerBlock.number,
			blockhash: providerBlock.hash,
			timestamp: providerBlock.timestamp,
		}
	}

	async getAddress() {
		return this.signer.getAddress()
	}

	async getChain(): Promise<Chain> {
		return this.chain
	}

	async getChainId(): Promise<ChainId> {
		return this.network.chainId
	}

	async createActionSigner(sessionPrivateKey?: string): Promise<MetaMaskEthereumActionSigner> {
		const ethersWallet = sessionPrivateKey ? new ethers.Wallet(sessionPrivateKey) : ethers.Wallet.createRandom()
		return new MetaMaskEthereumActionSigner(ethersWallet)
	}

	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const sessionSignatureData = getSessionSignatureData(payload)
		const signature = await this.signer._signTypedData(...sessionSignatureData)
		return { signature, payload }
	}
}

export class MetaMaskEthereumActionSigner implements ActionSigner {
	wallet: ethers.Wallet

	constructor(wallet: ethers.Wallet) {
		this.wallet = wallet
	}

	get address(): string {
		return this.wallet.address
	}

	get privateKey(): string {
		return this.wallet.privateKey
	}

	async signActionPayload(payload: ActionPayload): Promise<Action> {
		const signatureData = getActionSignatureData(payload)
		const signature = await this.wallet._signTypedData(...signatureData)
		return { session: this.wallet.address, signature, payload }
	}
}
