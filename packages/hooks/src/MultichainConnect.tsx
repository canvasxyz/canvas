import type { Connector, SessionWallet } from "@canvas-js/signers"
import React, { useState } from "react"
import { MultichainConnectContext } from "./MultichainConnectContext.js"

interface MultichainConnectProps {
	children: React.ReactNode
	connectors: Connector[]
}

export const MultichainConnect: React.FC<MultichainConnectProps> = (props) => {
	const error = null
	const [address, setAddress] = useState<string | null>(null)
	const [sessionWallet, setSessionWallet] = useState<SessionWallet | null>(null)
	const [connector, setConnector] = useState<Connector | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(false)
	const [isConnected, setIsConnected] = useState<boolean>(false)

	return (
		<MultichainConnectContext.Provider
			value={{
				error,
				sessionWallet,
				setSessionWallet,
				isLoading,
				setIsLoading,
				isConnected,
				setIsConnected,
				address,
				setAddress,
				connector,
				setConnector,
				connectors: props.connectors,
			}}
		>
			{props.children}
		</MultichainConnectContext.Provider>
	)
}
