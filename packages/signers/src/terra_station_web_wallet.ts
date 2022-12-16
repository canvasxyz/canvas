import { Extension, LCDClient, TendermintAPI } from "@terra-money/terra.js"
import { ActionSigner, Connector, SessionSigner } from "./interfaces.js"
import { Block, SessionPayload, Session, Chain, ChainId } from "@canvas-js/interfaces"
import { EthereumActionSigner } from "./metamask_web_wallet.js"

type TerraAddress = {
	address: string
}

const extension = new Extension()

export class TerraStationWebWalletConnector implements Connector {
	id = "terra_station"
	label = "Terra Station"

	public get available() {
		return extension.isAvailable
	}

	async enable({ onAccountsChanged }: { onAccountsChanged: (accounts: string[]) => void }): Promise<void> {
		console.log("Attempting to enable Terra Station")

		// @ts-ignore
		window.terraExtension = extension

		// use a promise so that this function returns *after* the wallet has connected
		const accountAddr = await new Promise<TerraAddress>((resolve) => {
			extension.on("error", (err) => {
				console.log(err)
			})
			extension.on("onConnect", (a) => {
				console.log("connect")
				resolve(a)
			})
			extension.connect()
		}).catch((error) => {
			console.error(`Failed to enabled Terra Station ${error.message}`)
		})
		console.log(accountAddr)
		console.log("Connected to Terra Station")

		if (accountAddr) {
			onAccountsChanged([accountAddr.address])
		} else {
			throw Error("No address was returned on connection")
		}
	}
	disable(): void {
		throw new Error("Method not implemented.")
	}

	async createSessionSigner(account: string): Promise<SessionSigner> {
		return new TerraStationWebWalletSessionSigner(account)
	}
}

export class TerraStationWebWalletSessionSigner implements SessionSigner {
	chain: Chain = "cosmos"
	chainId = "phoenix-1"
	address: string

	constructor(address: string) {
		this.address = address
	}

	async getRecentBlock(): Promise<Block> {
		const client = new LCDClient({
			URL: "https://phoenix-lcd.terra.dev",
			chainID: "terra",
		})
		const tmClient = new TendermintAPI(client)
		const blockInfo = await tmClient.blockInfo()

		return {
			chain: this.chain,
			chainId: this.chainId,
			blocknum: parseInt(blockInfo.block.header.height),
			// TODO: is this the hash we should use? the terra.js API has no documentation
			blockhash: blockInfo.block.header.data_hash,
			// seconds since epoch
			timestamp: Math.floor(new Date(blockInfo.block.header.time).getTime() / 1000),
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

	async createActionSigner(sessionPrivateKey?: string): Promise<ActionSigner> {
		return new EthereumActionSigner(sessionPrivateKey)
	}

	async signSessionPayload(payload: SessionPayload): Promise<Session> {
		// timeout?
		const result = await new Promise<any>((resolve, reject) => {
			extension.on("onSign", (response: any) => {
				if (response.result?.signature) resolve(response.result)
				else reject()
			})
			try {
				extension.signBytes({
					bytes: Buffer.from(JSON.stringify(payload)),
				})
			} catch (error) {
				console.error(error)
			}
		})

		const signature = {
			signature: {
				pub_key: {
					type: "tendermint/PubKeySecp256k1",
					value: result.public_key,
				},
				signature: result.signature,
			},
		}
		return { signature: JSON.stringify(signature), payload }
	}
}
