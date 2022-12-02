import { Signer } from "@canvas-js/signers"
import { createContext, useContext, useState } from "react"
import { ethers } from "ethers"

/**
 * An attempt at making something like wagmi
 *
 * TODO: Extend this to support multiple chains
 * TODO: Move this into the signers package
 */

export interface MultichainConnectContextValue {
	address: string | null
	setAddress: (address: string | null) => void

	error: Error | null

	isConnected: boolean
	setIsConnected: (isConnected: boolean) => void

	isLoading: boolean
	setIsLoading: (isLoading: boolean) => void

	signer: Signer | null
	setSigner: (signer: Signer | null) => void
}

export const MultichainConnectContext = createContext<MultichainConnectContextValue>({
	address: null,
	setAddress: (_) => {
		throw new Error("Missing <MultichainConnectContext /> parent element")
	},

	error: null,

	isConnected: false,
	setIsConnected: (_) => {
		throw new Error("Missing <MultichainConnectContext /> parent element")
	},

	isLoading: false,
	setIsLoading: (_) => {
		throw new Error("Missing <MultichainConnectContext /> parent element")
	},

	signer: null,
	setSigner: (_) => {
		throw new Error("Missing <MultichainConnectContext /> parent element")
	},
})

export const useConnect = () => {
	const { signer, setSigner, setIsLoading, isConnected, setIsConnected, address, setAddress } =
		useContext(MultichainConnectContext)

	const connect = async () => {
		if (signer) {
			return
		}

		// TODO: use https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods to switch active
		// chain according to currently active node, if one exists
		console.log("Attempting to enable Metamask")
		setIsLoading(true)

		// this could all belong to a "Connector" abstraction? idk

		// enable
		// default to ETH
		// The "any" network will allow spontaneous network changes
		const ethereum = (window as any).ethereum
		const provider = new ethers.providers.Web3Provider(ethereum, "any")

		provider.on("network", (newNetwork, oldNetwork) => {
			// Force page refreshes on network changes, see https://docs.ethers.io/v5/concepts/best-practices/
			// When a Provider makes its initial connection, it emits a "network"
			// event with a null oldNetwork along with the newNetwork. So, if the
			// oldNetwork exists, it represents a changing network
			if (oldNetwork) {
				window.location.reload()
			}
		})
		// this is not abstracted away by ethers
		ethereum.on("accountsChanged", (accounts: string[]) => {
			setAddress(accounts[0])

			const providerSigner = provider.getSigner(accounts[0])
			setSigner(new Signer(providerSigner))
		})

		const accounts: string[] = await provider.send("eth_requestAccounts", [])

		// getSigner
		const providerSigner = provider.getSigner(accounts[0])
		setSigner(new Signer(providerSigner))

		// getAddress
		setAddress(accounts[0])

		setIsLoading(false)
		setIsConnected(true)
	}

	return { connect, isConnected, address }
}

export const useDisconnect = () => {
	const { isConnected, setIsConnected } = useContext(MultichainConnectContext)

	const disconnect = () => {
		if (!isConnected) {
			return
		}
		setIsConnected(false)
	}
	return { disconnect }
}

export const useSigner = () => {
	const { signer } = useContext(MultichainConnectContext)
	return { signer }
}
