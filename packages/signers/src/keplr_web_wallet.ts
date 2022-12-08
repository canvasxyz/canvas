import { Action, ActionPayload, Block } from "packages/interfaces/lib/actions.js"
import { Chain, ChainId } from "packages/interfaces/lib/contracts.js"
import { SessionPayload, Session } from "packages/interfaces/lib/sessions.js"
import { Connector, SessionSigner, ActionSigner } from "./interfaces.js"

import { OfflineSigner } from "@cosmjs/launchpad"
import { DirectSecp256k1HdWallet, OfflineDirectSigner, makeAuthInfoBytes, makeSignDoc } from "@cosmjs/proto-signing"
import { StargateClient } from "@cosmjs/stargate"
import type { Window as KeplrWindow, ChainInfo } from "@keplr-wallet/types"
import { getActionSignatureData, getSessionSignatureData } from "@canvas-js/verifiers"
import { Buffer } from "buffer"

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

export class KeplrWebWalletConnector implements Connector {
	_chainId: string | null
	_chain: string | null
	chainSettings: ChainSettings

	constructor() {
		this._chainId = null
		this._chain = null
		this.chainSettings = {
			id: "osmosis-1",
			url: "https://rpc-osmosis.blockapsis.com",
			rpc: "https://rpc-osmosis.blockapsis.com",
			meta: {
				bech32Prefix: "osmo",
				name: "osmosis",
				default_symbol: "...",
				decimals: 4,
				node: {
					altWalletUrl: "...",
				},
			},
		}
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		const keplr = (window as KeplrWindow).keplr!

		console.log("Attempting to enable Keplr web wallet")

		if (!keplr.experimentalSuggestChain) {
			alert("Please update to a more recent version of Keplr")
			return
		}

		// fetch chain id from URL using stargate client
		const client = await StargateClient.connect(this.chainSettings.url)
		const chainId = await client.getChainId()
		this._chainId = chainId
		client.disconnect()

		// try {
		try {
			await keplr.enable(this._chainId)
		} catch (err) {
			console.log(`Failed to enable chain: ${(err as any).message}. Trying experimentalSuggestChain...`)

			const bech32Prefix = this.chainSettings.meta.bech32Prefix
			const info: ChainInfo = {
				chainId: this._chainId,
				chainName: this.chainSettings.meta.name,
				rpc: this.chainSettings.rpc,
				// Note that altWalletUrl on Cosmos chains should be the REST endpoint -- if not available, we
				// use the RPC url as hack, which will break some querying functionality but not signing.
				rest: this.chainSettings.meta.node.altWalletUrl || this.chainSettings.url,
				bip44: {
					coinType: 118,
				},
				bech32Config: {
					bech32PrefixAccAddr: `${bech32Prefix}`,
					bech32PrefixAccPub: `${bech32Prefix}pub`,
					bech32PrefixValAddr: `${bech32Prefix}valoper`,
					bech32PrefixValPub: `${bech32Prefix}valoperpub`,
					bech32PrefixConsAddr: `${bech32Prefix}valcons`,
					bech32PrefixConsPub: `${bech32Prefix}valconspub`,
				},
				currencies: [
					{
						coinDenom: this.chainSettings.meta.default_symbol,
						coinMinimalDenom: `u${this.chainSettings.meta.default_symbol.toLowerCase()}`,
						coinDecimals: this.chainSettings.meta.decimals || 6,
					},
				],
				feeCurrencies: [
					{
						coinDenom: this.chainSettings.meta.default_symbol,
						coinMinimalDenom: `u${this.chainSettings.meta.default_symbol.toLowerCase()}`,
						coinDecimals: this.chainSettings.meta.decimals || 6,
					},
				],
				stakeCurrency: {
					coinDenom: this.chainSettings.meta.default_symbol,
					coinMinimalDenom: `u${this.chainSettings.meta.default_symbol.toLowerCase()}`,
					coinDecimals: this.chainSettings.meta.decimals || 6,
				},
				// gasPriceStep: { low: 0, average: 0.025, high: 0.03 },
				features: ["stargate"],
			}
			await keplr.experimentalSuggestChain(info)
			await keplr.enable(this._chainId)
			this._chain = this.chainSettings.id
		}
		console.log(`Enabled web wallet for ${this._chainId}`)

		// get the address
		const offlineSigner = keplr.getOfflineSigner(this._chainId)
		const accounts = await offlineSigner.getAccounts()
		onAccountsChanged(accounts.map((account) => account.address))
	}
	disable(): void {
		throw new Error("Method not implemented.")
	}
	async createSessionSigner(account: string): Promise<SessionSigner> {
		const keplr = (window as KeplrWindow).keplr!
		if (!this._chainId) {
			throw Error(`cannot create signer, chainId has not been set!`)
		}
		const providerSigner = keplr.getOfflineSigner(this._chainId)
		// const accounts = await providerSigner.getAccounts()
		return new KeplrWebWalletSessionSigner(providerSigner, account, this._chainId, this.chainSettings)
	}
}

export class KeplrWebWalletSessionSigner implements SessionSigner {
	signer: OfflineSigner & OfflineDirectSigner
	address: string
	chain: Chain = "cosmos"
	chainId
	chainSettings: ChainSettings

	constructor(
		signer: OfflineSigner & OfflineDirectSigner,
		address: string,
		chainId: any,
		chainSettings: ChainSettings
	) {
		this.signer = signer
		this.address = address
		this.chainId = chainId
		this.chainSettings = chainSettings
	}

	async getRecentBlock(): Promise<Block> {
		const client = await StargateClient.connect(this.chainSettings.url)
		const height = await client.getHeight()
		const block = await client.getBlock(height)

		return {
			chain: this.chain,
			chainId: this.chainId,
			blocknum: block.header.height,
			blockhash: `0x${block.id}`,
			// seconds since epoch
			timestamp: Math.floor(new Date(block.header.time).getTime() / 1000),
		}
	}
	async getAddress(): Promise<string> {
		return this.address
	}
	async createActionSigner(sessionPrivateKey?: string | undefined): Promise<ActionSigner> {
		const wallet = sessionPrivateKey
			? await DirectSecp256k1HdWallet.fromMnemonic(sessionPrivateKey)
			: await DirectSecp256k1HdWallet.generate()

		const accounts = await wallet.getAccounts()
		const address = accounts[0].address
		return new KeplrWebWalletActionSigner(wallet, address)
	}
	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const keplr = (window as KeplrWindow).keplr!
		const chainId = this.chainId

		const stdSignature = await keplr.signArbitrary(chainId, await this.getAddress(), JSON.stringify(payload))
		const signature = JSON.stringify(stdSignature)
		// const hexSignature = `0x${Buffer.from(signature, "base64").toString("hex")}`
		return { signature, payload }
	}
	async getChain(): Promise<Chain> {
		return this.chain
	}
	async getChainId(): Promise<ChainId> {
		return this.chainId
	}
}

export class KeplrWebWalletActionSigner implements ActionSigner {
	wallet: DirectSecp256k1HdWallet
	_address: string
	constructor(wallet: DirectSecp256k1HdWallet, address: string) {
		this.wallet = wallet
		this._address = address
	}
	get address(): string {
		return this._address
	}
	get privateKey(): string {
		return this.wallet.mnemonic
	}
	async signActionPayload(payload: ActionPayload): Promise<Action> {
		const generatedSignDoc = makeSignDoc(
			Buffer.from(JSON.stringify(payload)),
			// We are not signing a transaction so these fields don't matter
			makeAuthInfoBytes([], [], 0, undefined, undefined),
			"",
			0
		)

		const { signature } = await this.wallet.signDirect(this.address, generatedSignDoc)
		return { signature: signature.signature, payload, session: this.address }
	}
}
