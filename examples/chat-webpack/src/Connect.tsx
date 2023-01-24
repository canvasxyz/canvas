import React, { useMemo } from "react"

import { ethers } from "ethers"
import { useAccount, useConnect, useDisconnect, useSigner, useNetwork } from "wagmi"
import { useSession, useCanvasSigner } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { useConnectOneStep } from "./useConnectOneStep"

export const Connect: React.FC<{}> = ({}) => {
	const { connectors } = useConnect()
	const { connect, connectionState, disconnect, errors } = useConnectOneStep()

	const { address, isConnected } = useAccount()

	return (
		<div className="window">
			<div className="title-bar">
				<div className="title-bar-text">Connect</div>
			</div>
			<div className="window-body">
				{connectionState == "connected" ? (
					<>
						<p>Connected to {address}.</p>
						<button disabled={!isConnected} onClick={() => disconnect()}>
							Disconnect
						</button>
					</>
				) : connectionState == "awaiting_connection" ? (
					<>
						<p>Connecting...</p>
					</>
				) : connectionState == "awaiting_session" ? (
					<>
						<p>Logging in...</p>
					</>
				) : (
					<>
						<p>Connect to a provider:</p>
						{connectors.map((connector) => (
							<button
								disabled={!connector.ready}
								key={connector.id}
								onClick={() => connect({ connector })}
								style={{ marginRight: 5 }}
							>
								{connector.name}
								{!connector.ready && " (unsupported)"}
							</button>
						))}
					</>
				)}

				{errors.length > 0 && <ErrorMessage error={{ name: "", message: errors[0] }} />}
			</div>
		</div>
	)
}
