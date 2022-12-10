import React, { useMemo } from "react"

import { useSession } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { useSigner, useConnect, useDisconnect } from "@canvas-js/hooks"

export const Connect: React.FC<{}> = ({}) => {
	// TODO: Implement the error handling from wagmi
	// const { connect, connectors, error: connectionError, isLoading: isConnectionLoading, pendingConnector } = useConnect()
	const { connect, isConnected, address } = useConnect()
	const { disconnect } = useDisconnect()

	return (
		<div className="window">
			<div className="title-bar">
				<div className="title-bar-text">Connect</div>
			</div>
			<div className="window-body">
				{isConnected ? (
					<>
						<p>Connected to {address}.</p>
						<button disabled={!isConnected} onClick={() => disconnect()}>
							Disconnect
						</button>
					</>
				) : (
					<>
						<p>Connect to a provider:</p>
						<button disabled={isConnected} onClick={() => connect("eth")} style={{ marginRight: 5 }}>
							MetaMask
						</button>
						<button disabled={isConnected} onClick={() => connect("substrate")} style={{ marginRight: 5 }}>
							Polkadot
						</button>
						<button disabled={isConnected} onClick={() => connect("cosmos")} style={{ marginRight: 5 }}>
							Keplr
						</button>
						<button disabled={isConnected} onClick={() => connect("solana")} style={{ marginRight: 5 }}>
							Phantom
						</button>
						<button disabled={isConnected} onClick={() => connect("cosmos", "evmos")} style={{ marginRight: 5 }}>
							Keplr evmos
						</button>
					</>
				)}

				{/* <ErrorMessage error={connectionError} /> */}

				<Login />
			</div>
		</div>
	)
}

const Login: React.FC<{}> = ({}) => {
	const { signer } = useSigner()

	const {
		error: sessionError,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
		isLoading,
		isPending,
	} = useSession(signer)

	const [expirationDate, expirationTime] = useMemo(() => {
		if (sessionExpiration === null) {
			return [null, null]
		}

		const date = new Date(sessionExpiration)
		return [date.toLocaleDateString(), date.toLocaleTimeString()]
	}, [sessionExpiration])

	if (signer === undefined || signer === null) {
		return null
	}

	return (
		<>
			{sessionAddress === null ? (
				<>
					{isLoading ? <p>Loading...</p> : <p>Click Login to begin a new session.</p>}
					<button disabled={isLoading || isPending} onClick={login}>
						{isPending ? "Waiting for login" : "Login"}
					</button>
				</>
			) : (
				<>
					<p>
						Using session {sessionAddress}, which expires on {expirationDate} at {expirationTime}.
					</p>
					<button disabled={isLoading} onClick={logout}>
						Logout
					</button>
				</>
			)}

			{/* <ErrorMessage error={signerError} /> */}
			<ErrorMessage error={sessionError} />
		</>
	)
}
