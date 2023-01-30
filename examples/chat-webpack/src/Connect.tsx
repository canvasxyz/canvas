import React, { useContext, useEffect, useMemo } from "react"

import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork, useProvider } from "wagmi"
import { useSession } from "@canvas-js/hooks"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import { ErrorMessage } from "./ErrorMessage"
import { AppContext } from "./AppContext"

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
	const { error, data: signer } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()
	const provider = useProvider<ethers.providers.JsonRpcProvider>()

	const chainImplementation = useMemo(() => {
		console.log("chain", chain)
		return new EthereumChainImplementation(chain?.id.toString() ?? "1", provider)
	}, [chain?.id, provider])

	const { sessionAddress, sessionExpiration, login, logout, isLoading, isPending, client } = useSession(
		chainImplementation,
		signer
	)

	const { setClient } = useContext(AppContext)
	useEffect(() => setClient(client), [client])

	const [expirationDate, expirationTime] = useMemo(() => {
		if (sessionExpiration === null) {
			return [null, null]
		}

		const date = new Date(sessionExpiration)
		return [date.toLocaleDateString(), date.toLocaleTimeString()]
	}, [sessionExpiration])

	if (signer === undefined) {
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

			<ErrorMessage error={error} />
		</>
	)
}
