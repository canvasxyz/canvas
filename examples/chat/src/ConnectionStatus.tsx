import React, { useCallback, useContext, useEffect, useState } from "react"

import { Canvas, Connections } from "@canvas-js/core"

import { AppContext } from "./AppContext.js"

import { PeerIdView } from "./components/PeerIdView.js"

export interface ConnectionStatusProps {
	topic: string
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ topic }) => {
	const { app } = useContext(AppContext)

	const [status, setStatus] = useState("--")

	const updateConnectionStatus = () => {
		if (app) setStatus(app.status)
	}

	useEffect(() => {
		app?.addEventListener("connections:updated", updateConnectionStatus)
		return () => {
			app?.removeEventListener("connections:updated", updateConnectionStatus)
		}
	}, [app])

	if (app === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
			<div>
				<span className="text-sm">Topic</span>
			</div>
			<div>
				<code className="text-sm">{topic}</code>
			</div>
			<div>
				<span className="text-sm">Peer Id</span>
			</div>
			<div>
				<PeerIdView peerId={app.peerId} />
			</div>
			<hr />
			<div>
				<span className="text-sm">Online</span>
			</div>
			<OnlineList topic={topic} />
			<hr />
			<div>
				<span className="text-sm">Connections (Status: {status})</span>
			</div>
			<ConnectionList app={app} />
		</div>
	)
}

const OnlineList = ({ topic }: { topic: string }) => {
	return <div className="italic">No other clients online</div>
}

interface ConnectionListProps {
	app: Canvas
}

const ConnectionList: React.FC<ConnectionListProps> = ({ app }) => {
	const [connections, setConnections] = useState<Connections>()

	const handleConnectionsUpdate = useCallback(
		({ detail: { connections } }: CustomEvent<{ connections: Connections }>) => {
			setConnections({ ...connections })
		},
		[],
	)

	useEffect(() => {
		app?.addEventListener("connections:updated", handleConnectionsUpdate)
		return () => {
			app?.removeEventListener("connections:updated", handleConnectionsUpdate)
		}
	}, [app])

	if (!connections || Object.entries(connections).length === 0) {
		return <div className="italic">No connections</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{Object.entries(connections).map(([peerId, { peer, status, connections: peerConnections }]) => {
					return (
						<li key={peer.toString()}>
							<div>
								{status === "connecting" ? "🟡" : status === "online" ? "🟢" : status === "waiting" ? "⚪️" : "🔴"}
								&nbsp;
								<PeerIdView peerId={peer} />
							</div>
							<div>
								{peerConnections.map((connection, index) => {
									return (
										<code className="text-sm break-all text-gray-500" key={index}>
											{connection.remoteAddr.decapsulateCode(421).toString()}
										</code>
									)
								})}
							</div>
						</li>
					)
				})}
			</ul>
		)
	}
}
