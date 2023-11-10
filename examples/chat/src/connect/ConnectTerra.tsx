import React, { useCallback, useContext, useState } from "react"

import { Extension } from "@terra-money/feather.js"
import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"
import { Buffer } from "buffer"

export interface ConnectTerraProps {}

export const ConnectTerra: React.FC<ConnectTerraProps> = ({}) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		const extension = new Extension()

		const accountData = await new Promise<{ address: string; network: string }>((resolve) => {
			extension.once("onConnect", ({ address, network }) => resolve({ address, network }))
			extension.connect()
		}).catch((error) => {
			console.log(error)
			console.error(`Failed to enable Station ${error.message}`)
		})
		if (!accountData) {
			setError(new Error("address not found"))
			return
		}

		setAddress(accountData.address)
		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "bytes",
					getAddress: async () => accountData.address,
					getChainId: async () => accountData.network,
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
			})
		)
		setThisIsConnected(true)
	}, [address])

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
			<button
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
				onClick={() => disconnect()}
			>
				Disconnect Terra wallet
			</button>
		)
	} else {
		return (
			<button
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
				onClick={() => connect()}
			>
				Connect Terra wallet
			</button>
		)
	}
}
