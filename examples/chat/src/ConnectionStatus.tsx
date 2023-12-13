import React, { useCallback, useContext, useEffect, useRef, useState } from "react"
import { Libp2pEvents, Connection } from "@libp2p/interface"

import { AppContext } from "./AppContext.js"

export interface ConnectionStatusProps {}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({}) => {
	const { app } = useContext(AppContext)

	const [connections, setConnections] = useState<Connection[]>([])
	const connectionsRef = useRef(connections)

	const handleConnectionOpen = useCallback(({ detail: connection }: Libp2pEvents["connection:open"]) => {
		const connections = connectionsRef.current.concat(connection)
		connectionsRef.current = connections
		setConnections(connections)
	}, [])

	const handleConnectionClose = useCallback(({ detail: connection }: Libp2pEvents["connection:close"]) => {
		const connections = connectionsRef.current.filter(({ id }) => id !== connection.id)
		connectionsRef.current = connections
		setConnections(connections)
	}, [])

	useEffect(() => {
		if (app === null) {
			return
		}

		app.libp2p.addEventListener("connection:open", handleConnectionOpen)
		app.libp2p.addEventListener("connection:close", handleConnectionClose)

		return () => {
			app.libp2p.removeEventListener("connection:open", handleConnectionOpen)
			app.libp2p.removeEventListener("connection:close", handleConnectionClose)
		}
	}, [app])

	if (app === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2 bg-white">
			<div>
				<span className="text-sm">Peer Id</span>
			</div>
			<div>
				<code className="text-sm">{app.peerId.toString()}</code>
			</div>
			<hr />
			<div>
				<span className="text-sm">Connections</span>
			</div>
			<ConnectionList connections={connections} />
		</div>
	)
}

interface ConnectionListProps {
	connections: Connection[]
}

const ConnectionList: React.FC<ConnectionListProps> = ({ connections }) => {
	if (connections.length === 0) {
		return <div className="italic">No connections</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{connections.map((connection) => (
					<ConnectionListItem key={connection.id} connection={connection} />
				))}
			</ul>
		)
	}
}

interface ConnectionListItemProps {
	connection: Connection
}

const ConnectionListItem: React.FC<ConnectionListItemProps> = ({ connection }) => {
	const peer = connection.remotePeer.toString()
	const addr = connection.remoteAddr.decapsulateCode(421).toString()
	return (
		<li key={connection.id}>
			<div>
				<code className="text-sm">{peer}</code>
			</div>
			<div>
				<code className="text-sm break-all text-gray-500">{addr}</code>
			</div>
		</li>
	)
}
