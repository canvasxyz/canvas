import { ethers } from "ethers"
import { hexToNumber } from "web3-utils"
import { connect, disconnect, getProvider, signTypedData, configureChains, createClient } from "@wagmi/core"
import { WalletConnectConnector } from "wagmi/connectors/walletConnect"

import { mainnet } from "@wagmi/core/chains"

import { EthereumClient, modalConnectors, walletConnectProvider } from "@web3modal/ethereum"

import type { Block, Chain, ChainId, SessionPayload, Session } from "@canvas-js/interfaces"
import { getSessionSignatureData } from "@canvas-js/verifiers"

import { Connector, SessionSigner } from "./interfaces.js"
import { MetaMaskEthereumActionSigner } from "./metamask_web_wallet.js"
import { _TypedDataEncoder } from "ethers/lib/utils.js"

const PROJECT_ID = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
const chains = [mainnet]

export class WalletConnectWebWalletConnector implements Connector {
	id = "walletconnect_web"
	label = "WalletConnect"

	get available(): boolean {
		// Only available if the project id has been set
		return !!PROJECT_ID
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		console.log("Attempting to enable WalletConnect")

		// Wagmi Core Client
		const { provider } = configureChains(chains, [walletConnectProvider({ projectId: PROJECT_ID! })])
		const wagmiClient = createClient({
			connectors: modalConnectors({ appName: "web3Modal", chains }),
			provider,
		})

		new EthereumClient(wagmiClient, chains)

		const { account } = await connect({
			connector: new WalletConnectConnector({
				options: {
					qrcode: true,
					// rpc: {
					// Use the backend as an infura proxy?
					// 1: "",
					// },
				},
			}),
		})

		onAccountsChanged([account])
	}

	disable(): void {
		console.log("Attempting to reset WalletConnect")
		disconnect()
	}

	async createSessionSigner(address: string): Promise<SessionSigner> {
		return new WalletConnectWebWalletSessionSigner(address, mainnet.id!)
	}
}

class WalletConnectWebWalletSessionSigner implements SessionSigner {
	address: string
	chainId: number

	constructor(address: string, chainId: number) {
		this.address = address
		this.chainId = chainId
	}

	async getRecentBlock(): Promise<Block> {
		const provider = await getProvider({ chainId: this.chainId })
		const block = await provider.getBlock("latest")

		return {
			chain: await this.getChain(),
			chainId: await this.getChainId(),
			blocknum: hexToNumber(block.number),
			blockhash: block.hash,
			timestamp: hexToNumber(block.timestamp),
		}
	}

	async getAddress(): Promise<string> {
		return this.address
	}

	async createActionSigner(sessionPrivateKey?: string): Promise<MetaMaskEthereumActionSigner> {
		const ethersWallet = sessionPrivateKey ? new ethers.Wallet(sessionPrivateKey) : ethers.Wallet.createRandom()
		return new MetaMaskEthereumActionSigner(ethersWallet)
	}

	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const [domain, types, value] = getSessionSignatureData(payload)
		// @ts-expect-error
		const signature = await signTypedData({ domain, types, value })
		return { type: "session", signature, payload }
	}

	async getChain(): Promise<Chain> {
		return "eth"
	}

	async getChainId(): Promise<ChainId> {
		return this.chainId
	}
}
