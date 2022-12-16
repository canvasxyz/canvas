import React, { useEffect, useMemo, useState } from "react"

import { useConnect, useDisconnect, useSession, useSigner } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"

export const Connect: React.FC<{}> = ({}) => {
	// TODO: Implement the error handling from wagmi
	const { address, isConnected, connect, connectors } = useConnect()
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
						{connectors ? (
							<>
								<p>Connect to a provider:</p>
								{connectors
									.filter((connector) => connector.available)
									.map((connector) => (
										<button
											key={connector.id}
											disabled={isConnected}
											onClick={() => connect(connector)}
											style={{ marginRight: 5 }}
										>
											{connector.label}
										</button>
									))}
							</>
						) : (
							<p>No providers are available</p>
						)}
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
						Login
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
