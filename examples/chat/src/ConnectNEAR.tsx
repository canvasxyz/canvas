import React, { useCallback, useContext, useEffect, useState } from "react"

import { connect as nearConnect, keyStores, WalletConnection } from "near-api-js"

import { NEARSigner } from "@canvas-js/chain-near"

import { AppContext } from "./AppContext.js"

export interface ConnectNEARProps {
	contractId: string
	network: string
	recipient: string
}

export const ConnectNEAR: React.FC<ConnectNEARProps> = ({ contractId, network, recipient }) => {
	const { app, sessionSigner, setSessionSigner, address, setAddress } = useContext(AppContext)

	const [error, setError] = useState<Error | null>(null)

	const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(null)

	useEffect(() => {
		async function doSetup() {
			const keyStore = new keyStores.BrowserLocalStorageKeyStore()
			const connectionConfig = {
				networkId: network,
				keyStore,
				nodeUrl: `https://rpc.${network}.near.org`,
				walletUrl: `https://wallet.${network}.near.org`,
				helperUrl: `https://helper.${network}.near.org`,
				explorerUrl: `https://explorer.${network}.near.org`,
			}

			const nearConnection = await nearConnect(connectionConfig)
			const walletConnection = new WalletConnection(nearConnection, "canvas")

			const accountId = walletConnection._authData.accountId
			if (accountId) {
				const address = `near:${network}:${accountId}`

				const keyPair = await keyStore.getKey(network, accountId)
				console.log(keyPair)
				if (keyPair == null) {
					// no keypair found
				} else {
					const signer = new NEARSigner({ keyPair })
					setSessionSigner(signer)
					setAddress(address)
				}
			}

			setWalletConnection(walletConnection)
		}
		doSetup()
	}, [])

	const signIn = useCallback(async () => {
		if (!walletConnection) {
			return
		}
		await walletConnection.requestSignIn({
			contractId,
		})
	}, [walletConnection])

	const signOut = useCallback(async () => {
		if (!walletConnection) {
			return
		}
		setSessionSigner(null)
		walletConnection.signOut()
		const accountId = walletConnection._authData.accountId
		const address = accountId ? `near:${network}:${accountId}` : null
		setAddress(address)
	}, [walletConnection])

	if (error !== null) {
		return (
			<div className="p-2 border rounded bg-red-100 text-sm">
				<code>{error.message}</code>
			</div>
		)
	} else if (address !== null && sessionSigner instanceof NEARSigner) {
		return (
			<div className="p-2 border rounded hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200">
				<button onClick={() => signOut()}>Disconnect NEAR wallet</button>
			</div>
		)
	} else if (address === null) {
		const buttonEnabledClassName = `p-2 block w-full border-t hover:cursor-pointer hover:bg-gray-100 active:bg-gray-200`
		const buttonDisabledClassName = `p-2 block w-full border-t bg-gray-100 text-gray-600`
		const disabled = false // handle === ""
		return (
			<div className="border rounded">
				<div className="p-2 border-b">Connect NEAR</div>

				<button
					className={disabled ? buttonDisabledClassName : buttonEnabledClassName}
					disabled={disabled}
					onClick={(e) => {
						e.preventDefault()
						signIn()
					}}
				>
					Log in
				</button>
			</div>
		)
	} else {
		return (
			<div className="p-2 border rounded bg-gray-100 text-gray-600">
				<button disabled>Connect NEAR wallet</button>
			</div>
		)
	}
}
