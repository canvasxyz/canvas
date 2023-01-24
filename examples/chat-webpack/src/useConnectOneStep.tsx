import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork, Connector } from "wagmi"
import { useSession, useCanvasSigner } from "@canvas-js/hooks"

type ConnectionState = "disconnected" | "awaiting_connection" | "awaiting_session" | "connected"

export const useConnectOneStep = (): {
	connectionState: ConnectionState
	connect: ({ connector }: { connector: Connector<any, any, any> }) => void
	disconnect: () => void
	errors: string[]
	// address: string | null
} => {
	/**
	 * Hook that allows the user to log in with one click, instead of clicking on a "Connect" and then a "Log in"
	 * button.
	 *
	 * This implementation currently only supports wagmi as a connection method.
	 */

	const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
	const [errors, setErrors] = useState<string[]>([])

	// wagmi login state
	const { connect: wagmiConnect } = useConnect()
	const { disconnect: wagmiDisconnect } = useDisconnect()
	const { isConnected: wagmiIsConnected, status: wagmiAccountStatus } = useAccount()
	const { error: signerError, data: ethersSigner } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()

	// canvas login state
	const signer = useCanvasSigner(ethersSigner!, ethers.providers.getNetwork(chain?.id!))
	const { error: sessionError, login, logout, state: canvasState } = useSession(signer!)

	const logoutEverything = () => {
		logout()
		wagmiDisconnect()
		setConnectionState("disconnected")
	}

	// watch the state of wagmi and the canvas login hook
	// make state changes if necessary

	useEffect(() => {
		if (signer && canvasState == "logged_out") {
			if (connectionState == "awaiting_connection") {
				setConnectionState("awaiting_session")
				login()
			} else {
				if (connectionState == "awaiting_session") {
					// log in must have failed, reset
					console.log("canvas login aborted")
					logoutEverything()
				}
			}
		}
	}, [signer, canvasState])

	useEffect(() => {
		if (canvasState == "logged_in") {
			if (
				connectionState == "awaiting_session" ||
				connectionState == "awaiting_connection" ||
				connectionState == "disconnected"
			) {
				setConnectionState("connected")
			} else {
				logoutEverything()
			}
		}
	}, [canvasState])

	useEffect(() => {
		// log out if wagmi is disconnected while logged in
		if (wagmiAccountStatus == "disconnected" && canvasState == "logged_in" && connectionState == "connected") {
			logoutEverything()
		}
	}, [wagmiAccountStatus])

	// functions that can be called from the app

	const connect = ({ connector }: { connector: Connector<any, any, any> }) => {
		console.log("connect button clicked...")
		// clear errors
		setErrors([])
		if (connectionState !== "disconnected") {
			setErrors(["Cannot connect: must be in the disconnected state"])
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
		logoutEverything()
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

	return { connectionState, connect, disconnect, errors }
}
