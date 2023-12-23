import React, { useCallback, useContext, useEffect, useRef, useState } from "react"

import { Canvas, Connections } from "@canvas-js/core"

import { AppContext } from "./AppContext.js"

import { PeerIdView } from "./components/PeerIdView.js"

export interface ConnectionStatusProps {}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({}) => {
	const { app } = useContext(AppContext)

	const [status, setStatus] = useState("--")
	const [onlinePeers, setOnlinePeers] = useState({})

	const updateConnectionStatus = () => {
		if (app) setStatus(app.status)
	}
	const updateOnlinePeers = ({ detail: { peerId, peers } }) => {
		setOnlinePeers({ ...peers })
	}

	useEffect(() => {
		app?.addEventListener("connections:updated", updateConnectionStatus)
		app?.addEventListener("presence:join", updateOnlinePeers)
		app?.addEventListener("presence:leave", updateOnlinePeers)
		return () => {
			app?.removeEventListener("connections:updated", updateConnectionStatus)
			app?.removeEventListener("presence:join", updateOnlinePeers)
			app?.removeEventListener("presence:leave", updateOnlinePeers)
		}
	}, [app])

	if (app === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
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
			<OnlineList onlinePeers={onlinePeers} />
			<hr />
			<div>
				<span className="text-sm">Connections (Status: {status})</span>
			</div>
			<ConnectionList app={app} />
		</div>
	)
}

const OnlineList = ({ onlinePeers }: { onlinePeers: PresenceList }) => {
	const browserPeers = Object.entries(onlinePeers).filter(([peerId, { lastSeen, env }]) => env === "browser")
	const [time, setTime] = useState()

	useEffect(() => {
		const timer = setInterval(() => {
			setTime(new Date().getTime())
		}, 1000)
		return () => clearInterval(timer)
	}, [])

	if (browserPeers.length === 0) {
		return <div className="italic">No online clients</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{browserPeers.map(([peerId, { lastSeen, env, address }]) => {
					return (
						<li key={peerId}>
							<PeerIdView peerId={peerId} />
							{address && (
								<div>
									<code className="text-sm break-all text-gray-500">{address}</code>
								</div>
							)}
							<div>
								<code className="text-sm break-all text-gray-500">
									Last seen {Math.ceil((time - lastSeen) / 1000)}sec
								</code>
							</div>
						</li>
					)
				})}
			</ul>
		)
	}
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
