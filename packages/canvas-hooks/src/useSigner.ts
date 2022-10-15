import { useState, useEffect, useCallback } from "react"

import { ethers } from "ethers"

import { CANVAS_SESSION_KEY } from "./useSession.js"

declare global {
	var ethereum: ethers.providers.Provider & ethers.providers.ExternalProvider & { isConnected: () => boolean }
}

/**
 * Here are the rules for the useSigner hook:
 * - Initially, `loading` is true and `signer` and `address` are null.
 * - When `loading` is false, `signer` and `address` might still be null,
 *   in which case you must call `connect` to request accounts.
 * - Calling `connect` while `loading` is true will throw an error.
 * - Calling `connect` with `window.ethereum === undefined` will throw an error.
 */
export function useSigner(): {
	loading: boolean
	address: string | null
	signer: ethers.providers.JsonRpcSigner | null
	provider: ethers.providers.Provider | null
	connect: () => Promise<void>
} {
	const [loading, setLoading] = useState(true)
	const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null)

	const [signer, setSigner] = useState<ethers.providers.JsonRpcSigner | null>(null)
	const [address, setAddress] = useState<string | null>(null)

	const connect = useCallback(async () => {
		if (loading) {
			throw new Error("connect() called too soon - wait for loading to be false!")
		} else if (provider === null) {
			throw new Error("No window.ethereum provider found. Install MetaMask if you haven't!")
		}

		await provider.send("eth_requestAccounts", [])
	}, [loading, provider])

	useEffect(() => {
		if (window.ethereum === undefined) {
			console.error("Could not find injected wallet provider")
			setLoading(false)
			return
		}

		const provider = new ethers.providers.Web3Provider(window.ethereum)

		function handleAccountsChanged(accounts: string[]) {
			if (accounts.length > 0) {
				const address = accounts[0].toLowerCase()
				const signer = provider.getSigner(address)
				setAddress(address)
				setSigner(signer)
			} else {
				setAddress(null)
				setSigner(null)
			}
		}

		window.ethereum.on("accountsChanged", handleAccountsChanged)

		provider.send("eth_accounts", []).then((accounts) => {
			setLoading(false)
			setProvider(provider)
			if (accounts.length > 0) {
				const address = accounts[0].toLowerCase()
				const signer = provider.getSigner(address)
				setAddress(address)
				setSigner(signer)
			}
		})

		return () => {
			window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
		}
	}, [])

	return { loading, connect, signer, provider, address }
}
