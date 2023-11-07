import React, { useCallback, useContext, useState } from "react"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"
import { CosmosSigner } from "@canvas-js/chain-cosmos"
// import { WalletController, getChainOptions } from "@terra-money/wallet-controller"
import { Extension } from "@terra-money/feather.js"
import { Buffer } from "buffer"

export interface ConnectTerraProps {}

export const ConnectTerra: React.FC<ConnectTerraProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	// const [controller, setController] = useState<WalletController | null>(null)
	const [extension, setExtension] = useState<Extension | null>(null)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		const extension = new Extension()

		const accountAddr = await new Promise<string>((resolve) => {
			extension.once("onConnect", ({ address }) => resolve(address))
			extension.connect()
		}).catch((error) => {
			console.log(error)
			console.error(`Failed to enable Station ${error.message}`)
		})

		// if (accountAddr && !this._accounts.includes(accountAddr)) {
		// 	this._accounts.push(accountAddr)
		// }
		if (!accountAddr) {
			setError(new Error("address not found"))
			return
		}

		setAddress(accountAddr)
		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "bytes",
					getAddress: async () => accountAddr,
					signBytes: async (signBytes: Uint8Array) =>
						new Promise((resolve, reject) => {
							extension.on("onSign", (payload) => {
								if (payload.result?.signature) resolve(payload.result)
								else reject(new Error("no signature"))
							})
							try {
								extension.signBytes({ bytes: Buffer.from(signBytes) })
							} catch (error) {
								reject(error)
							}
						}),
				},
				store: sessionStore,
			})
		)

		/*
		const chainOptions = await getChainOptions()
		const controller = new WalletController(chainOptions)
		await controller.connect()

		setController(controller)

		// get the first address
		const wallet = controller.connectedWallet()
		wallet.subscribe((connectedWallet) => {
			if (connectedWallet) {
				const accountAddr = connectedWallet.walletAddress

				if (address == null) {
					if (accountAddr) {
						setAddress(accountAddr)
					}
				} else {
					// address has already been set and must have then changed
					if (address !== accountAddr) {
						// reload page
						window.location.reload()
					}
				}
			}
		})

		if (address == null) {
			setError(new Error("address not found"))
			return
		}

		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "bytes",
					getAddress: async () => address,
					// @ts-ignore
					signBytes: async (signBytes: Uint8Array) => {
						const { result } = await controller.signBytes(Buffer.from(signBytes))
						result.public_key
					},
				},
				store: sessionStore,
			})
		)
		setThisIsConnected(true)
    */
	}, [address, extension])

	const disconnect = useCallback(async () => {
		setAddress(null)
		setSessionSigner(null)
		setThisIsConnected(false)
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (address !== null && thisIsConnected) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect Terra wallet</button>
			</div>
		)
	} else if (address === null) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect()}>Connect Terra wallet</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect Terra wallet</button>
			</div>
		)
	}
}
