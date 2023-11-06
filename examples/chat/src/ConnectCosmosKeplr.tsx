import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
// TODO: CosmosSigner should also support OfflineDirectSigner
import type { Window as KeplrWindow, OfflineAminoSigner /*, OfflineDirectSigner */ } from "@keplr-wallet/types"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "./AppContext.js"
import { sessionStore } from "./utils.js"

declare global {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Window extends KeplrWindow {}
}

export interface ConnectCosmosKeplrProps {
	chainId: string
}

export const ConnectCosmosKeplr: React.FC<ConnectCosmosKeplrProps> = ({ chainId }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [offlineSigner, setOfflineSigner] = useState<OfflineAminoSigner /*| OfflineDirectSigner */ | undefined>()

	const [error, setError] = useState<Error | null>(null)

	const initialRef = useRef(false)
	useEffect(() => {
		if (initialRef.current) {
			return
		}

		initialRef.current = true

		async function doSetup() {
			const keplr = window.keplr
			if (!keplr) {
				setError(new Error("window.keplr not found"))
				return
			}
			await keplr.enable(chainId)

			// TODO: CosmosSigner should also support OfflineDirectSigner

			// @ts-ignore
			setOfflineSigner(await keplr.getOfflineSignerAuto(chainId))

			// TODO: register event listeners for when the user changes accounts or networks
		}

		doSetup()
	}, [])

	const connect = useCallback(async () => {
		const keplr = window.keplr
		if (!keplr) {
			setError(new Error("window.keplr not found"))
			return
		}

		if (!offlineSigner) {
			setError(new Error("offlineSigner not found"))
			return
		}

		const address = (await offlineSigner.getAccounts())[0].address

		setAddress(address)
		setSessionSigner(
			new CosmosSigner({
				signer: {
					signAmino: keplr.signAmino,
					getAddress: async () => address,
				},
				store: sessionStore,
			})
		)
	}, [offlineSigner])

	const disconnect = useCallback(async () => {
		setAddress(null)
		setSessionSigner(null)
	}, [sessionSigner])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (offlineSigner === null) {
		return (
			<div className="p-2 border rounded bg-gray-200">
				<button disabled>Loading...</button>
			</div>
		)
	} else if (address !== null && sessionSigner instanceof CosmosSigner) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => disconnect()}>Disconnect Keplr (Cosmos) wallet</button>
			</div>
		)
	} else if (address === null) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect()}>Connect Keplr (Cosmos) wallet</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect Keplr (Cosmos) wallet</button>
			</div>
		)
	}
}
