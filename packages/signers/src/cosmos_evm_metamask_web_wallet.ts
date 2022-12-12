import bech32 from "bech32"

import type { ActionSigner, Connector, SessionSigner } from "./interfaces"
import type { Block, SessionPayload, Session, Chain, ChainId } from "packages/interfaces/lib"

import Web3 from "web3"
import { Address } from "@ethereumjs/util"
import { StargateClient } from "@cosmjs/stargate"
import { Secp256k1HdWallet } from "@cosmjs/amino"

import { KeplrWebWalletActionSigner } from "./keplr_web_wallet.js"

type ChainSettings = {
	id: string
	url: string
	rpc: string
	meta: {
		bech32Prefix: string
		name: string
		default_symbol: string
		decimals: number
		node: {
			altWalletUrl: string
		}
	}
}

function encodeEthAddress(bech32Prefix: string, address: string): string {
	const addressBuffer = Address.fromString(address).toBuffer()
	return bech32.encode(bech32Prefix, bech32.toWords(addressBuffer))
}

function decodeEthAddress(address: string): { bech32Prefix: string; address: string } {
	// return the address encoded as a cosmos address
	const { prefix, words } = bech32.decode(address)
	console.log(prefix)
	const pubkey = Buffer.from(bech32.fromWords(words))
	const ethAddress = `0x${pubkey.toString("hex")}`

	console.log(`${address} -> ${ethAddress}`)
	return {
		bech32Prefix: prefix,
		address: ethAddress,
	}
}

export class CosmosEvmWebWalletConnector implements Connector {
	id = "cosmos_evm"

	label = "Cosmos EVM"

	_chainId: string | null
	_web3: Web3 | null
	chainSettings: ChainSettings

	constructor() {
		this._web3 = null
		this._chainId = null
		this.chainSettings = {
			id: "evmos_9001-2",
			url: "https://tendermint.bd.evmos.org:26657/",
			rpc: "https://tendermint.bd.evmos.org:26657/",
			meta: {
				bech32Prefix: "evmos",
				name: "evmos",
				default_symbol: "...",
				decimals: 4,
				node: {
					altWalletUrl: "...",
				},
			},
		}
	}

	get available(): boolean {
		// @ts-ignore
		return !!window.ethereum
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		console.log("Attempting to enable Metamask")

		// (this needs to be called first, before other requests)
		const web3 = new Web3((window as any).ethereum)
		await web3.givenProvider.enable()

		const ethAccounts = await web3.eth.getAccounts()
		// const provider = web3.currentProvider
		let accounts: string[] = []
		if (ethAccounts.length === 0) {
			throw new Error("Could not fetch accounts from Metamask")
		} else {
			for (const acc of ethAccounts) {
				// chainSettings?
				accounts.push(encodeEthAddress(this.chainSettings.meta.bech32Prefix || "inj", acc))
			}
		}

		// fetch chain id from URL using stargate client
		const client = await StargateClient.connect(this.chainSettings.url)
		this._chainId = await client.getChainId()

		onAccountsChanged(accounts)
	}

	disable(): void {
		// TODO: implement this
	}

	async createSessionSigner(account: string): Promise<SessionSigner> {
		if (!this._chainId) {
			throw Error("Cannot create SessionSigner, the chainId has not been set")
		}
		return new CosmosEvmWebWalletSessionSigner(account, this._chainId, this.chainSettings)
	}
}

class CosmosEvmWebWalletSessionSigner implements SessionSigner {
	account: string
	chain: Chain = "cosmos"
	chainId: string
	chainSettings: ChainSettings

	constructor(account: string, chainId: string, chainSettings: ChainSettings) {
		this.account = account
		this.chainId = chainId
		this.chainSettings = chainSettings
	}

	async getRecentBlock(): Promise<Block> {
		const client = await StargateClient.connect(this.chainSettings.url)
		const block = await client.getBlock()

		return {
			chain: this.chain,
			chainId: this.chainId!,
			blocknum: block.header.height,
			blockhash: `0x${block.id}`,
			// seconds since epoch
			timestamp: Math.floor(new Date(block.header.time).getTime() / 1000),
		}
	}

	async getAddress(): Promise<string> {
		return this.account
	}

	async createActionSigner(sessionPrivateKey?: string | undefined): Promise<ActionSigner> {
		const wallet = sessionPrivateKey
			? await Secp256k1HdWallet.fromMnemonic(sessionPrivateKey)
			: await Secp256k1HdWallet.generate()

		const accounts = await wallet.getAccounts()
		const address = accounts[0].address
		return new KeplrWebWalletActionSigner(wallet, address)
	}

	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		console.log(payload)
		const web3 = new Web3((window as any).ethereum)
		const signature = await web3.eth.personal.sign(JSON.stringify(payload), decodeEthAddress(this.account).address, "")
		return { signature, payload }
	}

	async getChain(): Promise<Chain> {
		return this.chain
	}

	async getChainId(): Promise<ChainId> {
		return this.chainId
	}
}
