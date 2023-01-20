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

	console.log(`wagmi account status: ${status}`)
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

	useEffect(() => {
		// get the wallet address when wagmi connects
		if (wagmiAccountStatus == "connected") {
			console.log("wagmi is connected")
			console.log(connectionState)
			if (connectionState == "awaiting_connection" || connectionState == "connected") {
				console.log(wagmiAccountAddress)
				setAddress(wagmiAccountAddress)
			}
		}
	}, [wagmiAccountStatus])

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

	useEffect(() => {
		if (wagmiIsConnected) {
			if (connectionState !== "awaiting_connection" && connectionState !== "page_loaded") {
				console.log(connectionState)
				reset()
				return
			}
		}
	}, [wagmiIsConnected])

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

	const disconnect = () => {
		if (connectionState == "disconnected") {
			setErrors(["Cannot disconnect: already disconnected"])
			return
		}
		logout()
		wagmiDisconnect()
		setConnectionState("disconnected")
	}

	return { connectionState, connect, disconnect, errors, address }
}
