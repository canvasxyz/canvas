import React, { useCallback, useContext, useState } from "react"
import { Window as KeplrWindow, EthSignType } from "@keplr-wallet/types"
import { bytesToHex } from "@noble/hashes/utils"
import { fromBech32 } from "@cosmjs/encoding"

import { CosmosSigner } from "@canvas-js/chain-cosmos"

import { AppContext } from "../AppContext.js"

declare global {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	interface Window extends KeplrWindow {}
}

export interface ConnectEthereumKeplrProps {
	chainId: string
}

export const ConnectEthereumKeplr: React.FC<ConnectEthereumKeplrProps> = ({ chainId }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	// true if this signing method is being used
	const [thisIsConnected, setThisIsConnected] = useState(false)

	const [error, setError] = useState<Error | null>(null)

	const connect = useCallback(async () => {
		const keplr = window.keplr
		if (!keplr) {
			setError(new Error("window.keplr not found"))
			return
		}

		await keplr.enable(chainId)
		const offlineSigner = await keplr.getOfflineSignerAuto(chainId)
		const accounts = await offlineSigner.getAccounts()
		const address = accounts[0].address
		const { prefix, data: addressData } = fromBech32(address)
		const ethAddress = `0x${bytesToHex(addressData)}`

		setAddress(address)
		setSessionSigner(
			new CosmosSigner({
				signer: {
					type: "ethereum",
					signEthereum: async (chainId: string, signerAddress: string, message: string) => {
						const signatureBytes = await keplr.signEthereum(chainId, address, message, EthSignType.MESSAGE)
						return `0x${bytesToHex(signatureBytes)}`
					},
					getAddress: async () => ethAddress,
					getChainId: async () => chainId,
				},
			})
		)
		setThisIsConnected(true)
	}, [])

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
				<button onClick={() => disconnect()}>Disconnect Keplr (Ethereum) wallet</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => connect()}>Connect Keplr (Ethereum) wallet</button>
			</div>
		)
	}
}
