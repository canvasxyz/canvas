import { createContext, useContext } from "react"

import { Chain } from "@canvas-js/interfaces"
import {
	Connector,
	MetaMaskEthereumConnector,
	PolkadotWebWalletConnector,
	KeplrWebWalletConnector,
	PhantomWebWalletConnector,
	EVMKeplrWebWalletConnector,
	SessionSigner,
} from "@canvas-js/signers"

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

	signer: SessionSigner | null
	setSigner: (signer: SessionSigner | null) => void

	connector: Connector | null
	setConnector: (connector: Connector | null) => void

	connectors: Connector[] | null
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

	connector: null,
	setConnector: (_) => {
		throw new Error("Missing <MultichainConnectContext /> parent element")
	},

	connectors: null,
})

export const useConnect = () => {
	const {
		signer,
		setSigner,
		connector,
		connectors,
		setConnector,
		setIsLoading,
		isConnected,
		setIsConnected,
		address,
		setAddress,
	} = useContext(MultichainConnectContext)

	// TODO: replace this call with a direct call to the connector
	const connect = async (newConnector: Connector) => {
		if (signer) {
			// the app is already logged in
			return
		}

		if (connector) {
			// the app is already connected
			return
		}

		setIsLoading(true)

		const onAccountsChanged = async (accounts: string[]) => {
			setAddress(accounts[0])
			const newSigner = await newConnector.createSessionSigner(accounts[0])
			setSigner(newSigner)
		}

		await newConnector.enable({ onAccountsChanged })

		setConnector(connector)
		setIsLoading(false)
		setIsConnected(true)
	}

	return { connect, isConnected, connectors, address }
}

export const useDisconnect = () => {
	const { isConnected, setIsConnected, connector, setConnector, setSigner } = useContext(MultichainConnectContext)

	const disconnect = () => {
		if (!isConnected) {
			return
		}

		if (connector) {
			connector.disable()
			setConnector(null)
		}
		setSigner(null)
		setIsConnected(false)
	}
	return { disconnect }
}

export const useSigner = () => {
	const { signer } = useContext(MultichainConnectContext)
	return { signer }
}
