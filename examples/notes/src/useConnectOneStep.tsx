import { useEffect, useState } from "react"
import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork, Connector, useProvider } from "wagmi"
import { Client, useSession } from "@canvas-js/hooks"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

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
	client: Client | null
} => {
	const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
	const [errors, setErrors] = useState<string[]>([])

	// wagmi login state
	const { connect: wagmiConnect } = useConnect()
	const { disconnect: wagmiDisconnect } = useDisconnect()
	const { isConnected: wagmiIsConnected, status: wagmiAccountStatus, address: wagmiAccountAddress } = useAccount()
	const { error: signerError, data: signer } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()
	const provider = useProvider<ethers.providers.JsonRpcProvider>()

	// canvas login state
	const chainImplementation = new EthereumChainImplementation(chain?.id.toString(), provider)
	// const signer = useCanvasSigner(ethersSigner!, ethers.providers.getNetwork(chain?.id!))
	const { login, logout, isLoading, isPending, client } = useSession(chainImplementation, signer)

	const logoutEverything = () => {
		logout()
		wagmiDisconnect()
		setConnectionState("disconnected")
	}

	useEffect(() => {
		console.log(
			`wagmiAccountStatus: ${wagmiAccountStatus}, canvasIsLoading: ${isLoading}, canvasIsPending: ${isPending}, connectionState: ${connectionState}`
		)
	}, [wagmiAccountStatus, isLoading, isPending, connectionState])

	// watch the state of wagmi and the canvas login hook
	// make state changes if necessary

	useEffect(() => {
		// isLoading == false && isPending == false
		// if the
		if (!isLoading && !isPending) {
			if (client) {
				if (
					connectionState == "awaiting_session" ||
					connectionState == "awaiting_connection" ||
					connectionState == "disconnected"
				) {
					setConnectionState("connected")
				} else {
					// wagmi and canvas are logged in, but we are in an invalid state
					logoutEverything()
				}
			} else if (signer) {
				if (connectionState == "awaiting_connection") {
					setConnectionState("awaiting_session")
					login()
				} else {
					if (connectionState == "awaiting_session") {
						// log in must have failed/been rejected by user, reset
						console.log("canvas login aborted")
						logoutEverything()
					}
				}
			}
		}
	}, [client, signer, isLoading, isPending])

	useEffect(() => {}, [isLoading, isPending])

	useEffect(() => {
		// log out if wagmi is disconnected while logged in
		if (wagmiAccountStatus == "disconnected" && !isLoading && !isPending && connectionState == "connected") {
			logoutEverything()
		}
	}, [wagmiAccountStatus])

	// functions that can be called from the app

	const connect = () => {
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

	// useEffect(() => {
	// 	if (sessionError) {
	// 		setErrors([sessionError.message])
	// 	}
	// }, [sessionError])

	return { connectionState, connect, disconnect, errors, address: wagmiAccountAddress || null, client }
}
