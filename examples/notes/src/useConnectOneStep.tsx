import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork, Connector } from "wagmi"
import { useSession, useCanvasSigner } from "@canvas-js/hooks"

type ConnectionState = "disconnected" | "awaiting_connection" | "awaiting_session" | "connected"

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
	const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
	const [errors, setErrors] = useState<string[]>([])

	// wagmi login state
	const { connect: wagmiConnect } = useConnect()
	const { disconnect: wagmiDisconnect } = useDisconnect()
	const { isConnected: wagmiIsConnected, status: wagmiAccountStatus, address: wagmiAccountAddress } = useAccount()
	const { error: signerError, data: ethersSigner } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()

	// canvas login state
	const signer = useCanvasSigner(ethersSigner!, ethers.providers.getNetwork(chain?.id!))
	const { error: sessionError, login, logout, state: canvasState } = useSession(signer!)

	const reset = () => {
		console.log("reset")
		logout()
		wagmiDisconnect()
		setConnectionState("disconnected")
	}

	useEffect(() => {
		console.log(
			`wagmiAccountStatus: ${wagmiAccountStatus}, canvasState: ${canvasState}, connectionState: ${connectionState}`
		)
	}, [wagmiAccountStatus, canvasState, connectionState])

	// watch the state of wagmi and the canvas login hook
	// make state changes if necessary

	useEffect(() => {
		if (signer && canvasState == "logged_out") {
			if (connectionState == "awaiting_connection") {
				login()

				setConnectionState("awaiting_session")
			}
		}
	}, [signer, canvasState])

	useEffect(() => {
		if (canvasState == "logged_in") {
			if (connectionState == "awaiting_session" || connectionState == "disconnected") {
				setConnectionState("connected")
			} else {
				reset()
			}
		}
	}, [canvasState])

	useEffect(() => {
		// log out if wagmi is disconnected while logged in
		if (wagmiAccountStatus == "disconnected" && canvasState == "logged_in" && connectionState == "connected") {
			logout()
			setConnectionState("disconnected")
		}
	}, [wagmiAccountStatus])

	// functions that can be called from the app

	const connect = () => {
		console.log("connect button clicked...")
		if (connectionState !== "disconnected") {
			setErrors(["Cannot connect: must be in the disconnected state"])
			reset()
			return
		}

		setConnectionState("awaiting_connection")

		if (!wagmiIsConnected) {
			wagmiConnect({ connector })
		} else {
			login()
		}
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

	return { connectionState, connect, disconnect, errors, address: wagmiAccountAddress || null }
}
