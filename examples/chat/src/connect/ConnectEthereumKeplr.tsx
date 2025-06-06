import React, { useCallback, useContext, useState } from "react"
import { Window as KeplrWindow, EthSignType } from "@keplr-wallet/types"
import { bytesToHex } from "@noble/hashes/utils"
import { fromBech32 } from "@cosmjs/encoding"

import { CosmosSigner } from "@canvas-js/signer-cosmos"

import { AppContext } from "../AppContext.js"

declare global {
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
		if (app === null) {
			setError(new Error("app not initialized"))
			return
		}

		const keplr = window.keplr
		if (!keplr) {
			setError(new Error("window.keplr not found"))
			return
		}

		await keplr.enable(chainId)

		const offlineSigner = await keplr.getOfflineSignerAuto(chainId)
		const accounts = await offlineSigner.getAccounts()
		const accountAddress = accounts[0].address
		const { prefix: bech32Prefix, data: addressData } = fromBech32(accountAddress)
		const ethAddress = `0x${bytesToHex(addressData)}`

		const signer = new CosmosSigner({
			bech32Prefix,
			signer: {
				type: "ethereum",
				signEthereum: async (chainId: string, signerAddress: string, message: string) => {
					const signatureBytes = await keplr.signEthereum(chainId, signerAddress, message, EthSignType.MESSAGE)
					return `0x${bytesToHex(signatureBytes)}`
				},
				getAddress: async () => ethAddress,
				getChainId: async () => chainId,
			},
		})

		const address = await signer.getDid()
		setAddress(address)
		setSessionSigner(signer)
		setThisIsConnected(true)
	}, [chainId])

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
				onClick={() => disconnect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Disconnect Keplr (Ethereum) wallet
			</button>
		)
	} else {
		return (
			<button
				onClick={() => connect()}
				className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200"
			>
				Connect Keplr (Ethereum) wallet
			</button>
		)
	}
}
