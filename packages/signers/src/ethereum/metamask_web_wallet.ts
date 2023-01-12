import web3 from "web3"
import { ethers } from "ethers"
import { Block, Chain, ChainId, Session, SessionPayload } from "@canvas-js/interfaces"
import { getSessionSignatureData } from "@canvas-js/verifiers"
import { Connector, SessionSigner } from "../interfaces.js"
import { EthereumActionSigner } from "./ethereum_action_signer.js"

export class MetaMaskEthereumConnector implements Connector {
	id = "metamask"

	chain: Chain = "eth"
	provider?: ethers.providers.Web3Provider
	onAccountsChanged?: (accounts: string[]) => void
	onNetwork?: (newNetwork: any, oldNetwork: any) => void

	public readonly label = "MetaMask"

	constructor() {}

	public get available() {
		// @ts-ignore
		return !!window.ethereum
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }) {
		// enable
		// default to ETH
		// The "any" network will allow spontaneous network changes
		const ethereum = (window as any).ethereum
		this.provider = new ethers.providers.Web3Provider(ethereum, "any")

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
		if (this.provider && this.onNetwork) {
			this.provider.removeListener("network", this.onNetwork)
		}
		if (this.onAccountsChanged) {
			const ethereum = (window as any).ethereum
			ethereum.removeListener("accountsChanged", this.onAccountsChanged)
		}
	}

	async createSessionSigner(account: string): Promise<SessionSigner> {
		if (!this.provider) {
			throw Error("cannot create a SessionSigner, the wallet is not yet connected")
		}
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

	async getAddress() {
		return this.signer.getAddress()
	}

	async getChain(): Promise<Chain> {
		return this.chain
	}

	async getChainId(): Promise<ChainId> {
		return this.network.chainId.toString()
	}

	async createActionSigner(sessionPrivateKey?: string): Promise<EthereumActionSigner> {
		const ethersWallet = sessionPrivateKey ? new ethers.Wallet(sessionPrivateKey) : ethers.Wallet.createRandom()
		return new EthereumActionSigner(ethersWallet)
	}

	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const sessionSignatureData = getSessionSignatureData(payload)
		const signature = await this.signer._signTypedData(...sessionSignatureData)
		return { type: "session", signature, payload }
	}

	async getRecentBlock(): Promise<Block> {
		const { provider } = this.signer
		const block = await provider.getBlock("latest")

		return {
			chain: await this.getChain(),
			chainId: await this.getChainId(),
			blocknum: web3.utils.hexToNumber(block.number),
			blockhash: block.hash,
			timestamp: web3.utils.hexToNumber(block.timestamp),
		}
	}
}
