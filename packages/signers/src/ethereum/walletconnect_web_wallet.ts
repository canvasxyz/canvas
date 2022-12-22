import web3 from "web3"
import { ethers } from "ethers"
import { connect, disconnect, signTypedData, getProvider, configureChains, createClient } from "@wagmi/core"
import { WalletConnectConnector } from "@wagmi/connectors/walletConnect"

import { mainnet } from "@wagmi/core/chains"

import { EthereumClient, modalConnectors, walletConnectProvider } from "@web3modal/ethereum"

import type { Block, Chain, ChainId, SessionPayload, Session } from "@canvas-js/interfaces"
import { getSessionSignatureData } from "@canvas-js/verifiers"

import { Connector, SessionWallet } from "../interfaces.js"
import { EthereumActionWallet } from "./ethereum_action_wallet.js"
import { _TypedDataEncoder } from "ethers/lib/utils.js"

const chains = [mainnet]

export class WalletConnectWebWalletConnector implements Connector {
	id = "walletconnect_web"
	label = "WalletConnect"
	projectId: string

	constructor(projectId: string) {
		this.projectId = projectId
	}

	get available(): boolean {
		// Only available if the project id has been set
		const PROJECT_ID =
			process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
		return !!PROJECT_ID
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		const PROJECT_ID =
			process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

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

	async createSessionWallet(address: string): Promise<SessionWallet> {
		return new WalletConnectWebWalletSessionWallet(address, mainnet.id!)
	}
}

class WalletConnectWebWalletSessionWallet implements SessionWallet {
	address: string
	chainId: number

	constructor(address: string, chainId: number) {
		this.address = address
		this.chainId = chainId
	}

	async getAddress(): Promise<string> {
		return this.address
	}

	async createActionWallet(sessionPrivateKey?: string): Promise<EthereumActionWallet> {
		const ethersWallet = sessionPrivateKey ? new ethers.Wallet(sessionPrivateKey) : ethers.Wallet.createRandom()
		return new EthereumActionWallet(ethersWallet)
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

	async getRecentBlock(): Promise<Block> {
		const provider = await getProvider({ chainId: this.chainId })
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
