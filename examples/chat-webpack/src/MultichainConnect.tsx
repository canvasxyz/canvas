import { Signer } from "@canvas-js/signers"
import React, { useState } from "react"
import { MultichainConnectContext } from "./MultichainConnectContext"

interface MultichainConnectProps {
	children: React.ReactNode
}

export const MultichainConnect: React.FC<MultichainConnectProps> = (props) => {
	const error = null
	const [address, setAddress] = useState<string | null>(null)
	const [signer, setSigner] = useState<Signer | null>(null)
	const [isLoading, setIsLoading] = useState<boolean>(false)
	const [isConnected, setIsConnected] = useState<boolean>(false)

	return (
		<MultichainConnectContext.Provider
			value={{
				error,
				signer,
				setSigner,
				isLoading,
				setIsLoading,
				isConnected,
				setIsConnected,
				address,
				setAddress,
			}}
		>
			{props.children}
		</MultichainConnectContext.Provider>
	)
}
