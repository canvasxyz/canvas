import { web3Accounts, web3Enable, web3FromAddress } from "@polkadot/extension-dapp"
import { Signer as PolkadotSigner } from "@polkadot/api/types"
import { Keyring } from "@polkadot/api"
import { stringToHex } from "@polkadot/util"
import { SignerPayloadRaw } from "@polkadot/types/types/extrinsic"
import { ApiPromise, WsProvider } from "@polkadot/api"
import { mnemonicGenerate } from "@polkadot/util-crypto"
import { Connector, SessionSigner, ActionSigner } from "./interfaces"
import { Block, SessionPayload, Session, Action, ActionPayload, Chain, ChainId } from "packages/interfaces/lib"
import { addressSwapper } from "./utils.js"

export class PolkadotWebWalletConnector implements Connector {
	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		// window.location.reload()

		console.log("Attempting to enable Substrate web wallet")

		// returns an array of all the injected sources
		// (this needs to be called first, before other requests)
		try {
			const injectedExtensionInfo = await web3Enable("commonwealth")

			// returns an array of { address, meta: { name, source } }
			// meta.source contains the name of the extension that provides this account
			const accounts = await web3Accounts()
			onAccountsChanged(accounts.map((account: any) => account.address))
		} catch (error) {
			console.error("Failed to enable polkadot wallet")
		}
	}
	disable(): void {
		throw new Error("Method not implemented.")
	}
	async createSessionSigner(address: string): Promise<SessionSigner> {
		// finds an injector for an address
		// web wallet stores addresses in testnet format for now, so we have to re-encode
		const reencodedAddress = addressSwapper({
			address: address,
			currentPrefix: 42,
		})
		console.log("reencodedAddress:", reencodedAddress)
		const injector = await web3FromAddress(reencodedAddress)
		return new PolkadotWebWalletSessionSigner(reencodedAddress, injector.signer)
	}
}

class PolkadotWebWalletSessionSigner implements SessionSigner {
	chain: Chain = "substrate"
	chainId: ChainId = "edgeware"
	address: string
	signer: PolkadotSigner

	constructor(address: string, signer: PolkadotSigner) {
		this.address = address
		this.signer = signer
	}

	async getRecentBlock(): Promise<Block> {
		// TODO: are we using the polkadot API anywhere else on the frontend?
		// we probably want to point to whatever substrate node we are already running instead of a public API
		const api = await ApiPromise.create({
			provider: new WsProvider("wss://rpc.polkadot.io"),
		})
		const latestBlock = await api.rpc.chain.getBlock()
		const apiAt = await api.at(latestBlock.block.hash)
		const timestamp = await apiAt.query.timestamp.now()

		return {
			chain: "substrate",
			chainId: "unknown",
			blocknum: latestBlock.block.header.number.toNumber(),
			blockhash: latestBlock.block.hash.toString(),
			// @ts-ignore
			timestamp: timestamp.toNumber(),
		}
	}
	async getAddress(): Promise<string> {
		return this.address
	}
	async getChain(): Promise<Chain> {
		return this.chain
	}
	async getChainId(): Promise<ChainId> {
		return this.chainId
	}
	createActionSigner(sessionPrivateKey?: string | undefined): ActionSigner {
		const privateKey = sessionPrivateKey || mnemonicGenerate()

		return new PolkadotWebWalletActionSigner(privateKey)
	}
	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		const message = stringToHex(JSON.stringify(payload))
		const address = await this.getAddress()
		const signerPayload: SignerPayloadRaw = {
			address: address,
			data: message,
			type: "bytes",
		}
		const signature = (await this.signer.signRaw!(signerPayload)).signature
		console.log(signerPayload)
		console.log({ signature, payload })
		return { signature, payload }
	}
}

class PolkadotWebWalletActionSigner implements ActionSigner {
	keyring: Keyring
	pair: ReturnType<typeof Keyring.prototype.addFromUri>
	privateKeyMnemonic: string

	constructor(privateKey: string) {
		this.keyring = new Keyring()
		this.pair = this.keyring.addFromUri(privateKey, {}, "ed25519")
		this.privateKeyMnemonic = privateKey
	}
	get address(): string {
		return this.pair.address
	}
	get privateKey(): string {
		return this.privateKeyMnemonic
	}
	async signActionPayload(payload: ActionPayload): Promise<Action> {
		const message = stringToHex(JSON.stringify(payload))
		const address = this.address
		const signerPayload: SignerPayloadRaw = {
			address: address,
			data: message,
			type: "bytes",
		}
		const signature = Buffer.from(this.pair.sign(JSON.stringify(signerPayload))).toString()
		return {
			signature,
			payload,
			session: address,
		}
	}
}
