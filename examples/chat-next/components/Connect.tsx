import React, { useCallback, useState, useContext, useEffect, useMemo } from "react"

import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork, useProvider } from "wagmi"

import { Client, useSession } from "@canvas-js/hooks"
import { EthereumChainImplementation } from "@canvas-js/chain-ethereum"

import { ErrorMessage } from "./ErrorMessage"

export const Connect: React.FC<{ client: Client | null; setClient: (client: Client | null) => void }> = ({
	client,
	setClient,
}) => {
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
								{!connector.ready && " (unavailable)"}
								{isConnectionLoading && connector.id === pendingConnector?.id && " (connecting)"}
							</button>
						))}
					</>
				)}
				<ErrorMessage error={connectionError} />

				<Login setClient={setClient} />
				{client && <GenerateData client={client} baseNumberOfMessages={50} />}
			</div>
		</div>
	)
}

const Login: React.FC<{ setClient: (client: Client | null) => void }> = ({ setClient }) => {
	const { error, data: signer } = useSigner<ethers.providers.JsonRpcSigner>()
	const { chain } = useNetwork()
	const provider = useProvider<ethers.providers.JsonRpcProvider>()

	const chainImplementation = useMemo(() => {
		return new EthereumChainImplementation(chain?.id.toString() ?? "1", provider)
	}, [chain?.id, provider])

	const { sessionAddress, sessionExpiration, login, logout, isLoading, isPending, client } = useSession(
		chainImplementation,
		signer
	)

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

			<ErrorMessage error={error} />
		</>
	)
}

const GenerateData: React.FC<{ client: Client; baseNumberOfMessages: number }> = ({ client, baseNumberOfMessages }) => {
	const [count, setCount] = useState(0)

	const generateData = useCallback(
		(n: number) => {
			if (!client) return
			const timestamp = +Date.now()

			// make one post first, so we have a cached block and don't thrash the rpc
			client.createPost({ content: "generated #1" }, { timestamp }).then(() => {
				for (let i = 1; i < n; i++) {
					const content = `generated #${count + i + 1}`
					client.createPost({ content }, { timestamp: timestamp + i })
				}
				setCount(count + baseNumberOfMessages)
			})
		},
		[client]
	)

	if (!client) return <></>

	return (
		<p>
			<button disabled={!client} onClick={generateData.bind(this, baseNumberOfMessages)}>
				Create {baseNumberOfMessages} messages
			</button>{" "}
			<button disabled={!client} onClick={generateData.bind(this, baseNumberOfMessages * 10)}>
				Create {baseNumberOfMessages * 10} messages
			</button>
		</p>
	)
}
