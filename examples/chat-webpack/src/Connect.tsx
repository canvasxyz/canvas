import React, { useMemo } from "react"

import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork } from "wagmi"
import { useSession, useCanvasSigner } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"

export const Connect: React.FC<{}> = ({}) => {
	const { connect, connectors, error: connectionError, isLoading: isConnectionLoading, pendingConnector } = useConnect()
	const { disconnect } = useDisconnect()
	const { address, isConnected } = useAccount()

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
						{connectors.map((connector) => (
							<button
								disabled={!connector.ready || isConnected}
								key={connector.id}
								onClick={() => connect({ connector })}
								style={{ marginRight: 5 }}
							>
								{connector.name}
								{!connector.ready && " (unsupported)"}
								{isConnectionLoading && connector.id === pendingConnector?.id && " (connecting)"}
							</button>
						))}
					</>
				)}

				<ErrorMessage error={connectionError} />

				<Login />
			</div>
		</div>
	)
}

const Login: React.FC<{}> = ({}) => {
	const { error: signerError, data: originalSigner } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()
	const signer = useCanvasSigner(originalSigner!, ethers.providers.getNetwork(chain?.id!))

	const {
		error: sessionError,
		sessionAddress,
		sessionExpiration,
		login,
		logout,
		isLoading,
		isPending,
	} = useSession(signer!)

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

			<ErrorMessage error={signerError} />
			<ErrorMessage error={sessionError} />
		</>
	)
}
