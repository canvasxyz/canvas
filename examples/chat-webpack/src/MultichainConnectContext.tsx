import { Chain } from "@canvas-js/interfaces"
import type { Signer } from "@canvas-js/signers/lib/interfaces"
import { MetaMaskEthereumConnector } from "@canvas-js/signers/lib/metamask_ethereum"
import { createContext, useContext, useState } from "react"

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

	const connect = async (chain: Chain) => {
		if (signer) {
			return
		}

		setIsLoading(true)

		const connector = new MetaMaskEthereumConnector()

		const onAccountsChanged = (accounts: string[]) => {
			setAddress(accounts[0])
			setSigner(connector.createSigner(accounts[0]))
		}

		connector.enable({ onAccountsChanged })

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
