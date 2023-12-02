import React, { useCallback, useContext, useEffect, useRef, useState } from "react"

import type { Connection } from "@libp2p/interface/connection"
import { Canvas } from "@canvas-js/core"

import { AppContext } from "./AppContext.js"

import { PeerIdView } from "./components/PeerIdView.js"

export interface ConnectionStatusProps {}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({}) => {
	const { app } = useContext(AppContext)
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
				<span className="text-sm">Connections</span>
			</div>
			<ConnectionList app={app} />
		</div>
	)
}

interface ConnectionListProps {
	app: Canvas
}

const ConnectionList: React.FC<ConnectionListProps> = ({ app }) => {
	const [connections, setConnections] = useState<Connection[]>([])
	const connectionsRef = useRef<Connection[]>(connections)

	const handleConnectionOpen = useCallback(({ detail: connection }: CustomEvent<Connection>) => {
		const connections = [...connectionsRef.current, connection]
		setConnections(connections)
		connectionsRef.current = connections
	}, [])

	const handleConnectionClose = useCallback(({ detail: connection }: CustomEvent<Connection>) => {
		const connections = connectionsRef.current.filter(({ id }) => id !== connection.id)
		setConnections(connections)
		connectionsRef.current = connections
	}, [])

	useEffect(() => {
		app.libp2p?.addEventListener("connection:open", handleConnectionOpen)
		app.libp2p?.addEventListener("connection:close", handleConnectionClose)
		return () => {
			app.libp2p?.removeEventListener("connection:open", handleConnectionOpen)
			app.libp2p?.removeEventListener("connection:close", handleConnectionClose)
		}
	}, [])

	if (connections.length === 0) {
		return <div className="italic">No connections</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{connections.map((connection) => {
					return (
						<li key={connection.id}>
							<div>
								<PeerIdView peerId={connection.remotePeer} />
							</div>
							<div>
								<code className="text-sm break-all text-gray-500">
									{connection.remoteAddr.decapsulateCode(421).toString()}
								</code>
							</div>
						</li>
					)
				})}
			</ul>
		)
	}
}
