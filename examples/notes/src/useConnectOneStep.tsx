import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork, Connector } from "wagmi"
import { useSession, useCanvasSigner } from "@canvas-js/hooks"

type ConnectionState = "page_loaded" | "disconnected" | "awaiting_connection" | "awaiting_session" | "connected"

export const useConnectOneStep = ({
	connector,
}: {
	connector: Connector<any, any, any>
}): {
	connectionState: ConnectionState
	connect: () => void
	disconnect: () => void
	errors: string[]
	address: string | null
} => {
	const [connectionState, setConnectionState] = useState<ConnectionState>("page_loaded")
	const [address, setAddress] = useState<string | null>(null)
	const [errors, setErrors] = useState<string[]>([])

	// wagmi login state
	const { connect: wagmiConnect } = useConnect()
	const { disconnect: wagmiDisconnect } = useDisconnect()
	const {
		isConnected: wagmiIsConnected,
		status: wagmiAccountStatus,
		address: wagmiAccountAddress,
		status,
	} = useAccount()
	const { error: signerError, data: ethersSigner } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()

	// canvas login state
	const signer = useCanvasSigner(ethersSigner!, ethers.providers.getNetwork(chain?.id!))
	const {
		error: sessionError,
		sessionAddress,
		login,
		logout,
		isLoading: canvasIsLoading,
		isPending: canvasIsPending,
	} = useSession(signer!)

	const reset = () => {
		console.log("reset")
		wagmiDisconnect()
		setAddress(null)
		setConnectionState("disconnected")
	}

	// watch the state of wagmi and the canvas login hook
	// make state changes if necessary

	useEffect(() => {
		// get the wallet address when wagmi connects
		if (wagmiAccountStatus == "connected") {
			console.log(`w2 wagmi:${wagmiAccountStatus} canvas:${connectionState}`)
			console.log(connectionState)
			if (connectionState == "awaiting_connection" || connectionState == "connected") {
				console.log(wagmiAccountAddress)
				setAddress(wagmiAccountAddress)
			}
		}
	}, [wagmiAccountStatus])

	useEffect(() => {
		if (wagmiIsConnected) {
			console.log(`w1 wagmi:${wagmiAccountStatus} canvas:${connectionState}`)
			if (connectionState == "awaiting_connection" || connectionState == "page_loaded") {
			} else {
				console.log(connectionState)
				reset()
				return
			}
		}
	}, [wagmiIsConnected])

	useEffect(() => {
		if (signer && !canvasIsLoading) {
			console.log(`signer ? -> ${signer}`)
		}
	}, [signer])

	useEffect(() => {
		console.log(`canvasIsLoading: ${!canvasIsLoading} -> ${canvasIsLoading}`)
	}, [canvasIsLoading])

	useEffect(() => {
		if (signer && !canvasIsLoading) {
			if (connectionState == "awaiting_connection") {
				login()

				setConnectionState("awaiting_session")
			} else if (connectionState == "connected") {
			} else {
				reset()
			}
		}
	}, [signer, canvasIsLoading])

	useEffect(() => {
		if (canvasIsPending == false) {
			if (connectionState == "awaiting_session") {
				setConnectionState("connected")
			} else if (connectionState == "page_loaded") {
				setConnectionState("connected")
			} else {
				reset()
			}
		}
	}, [canvasIsPending])

	// functions that can be called from the app

	const connect = () => {
		if (connectionState !== "disconnected") {
			setErrors(["Cannot connect: must be in the disconnected state"])
			return
		}

		if (wagmiIsConnected) {
			setErrors(["Cannot connect, wagmi is already connected"])
			reset()
			return
		}

		wagmiConnect({ connector })
		setConnectionState("awaiting_connection")
	}

	const disconnect = () => {
		if (connectionState == "disconnected") {
			setErrors(["Cannot disconnect: already disconnected"])
			return
		}
		logout()
		wagmiDisconnect()
		setConnectionState("disconnected")
	}

	// return errors

	useEffect(() => {
		if (signerError) {
			setErrors([signerError.message])
		}
	}, [signerError])

	useEffect(() => {
		if (sessionError) {
			setErrors([sessionError.message])
		}
	}, [sessionError])

	return { connectionState, connect, disconnect, errors, address }
}
