import React, { useContext, useEffect, useState } from "react"
import type { Connection } from "@libp2p/interface"

import type { Canvas } from "@canvas-js/core"

import { AppContext } from "./AppContext.js"
import { MultiaddrView } from "./components/MultiaddrView.js"
import { PeerIdView } from "./components/PeerIdView.js"

export interface ConnectionStatusProps {
	topic: string
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ topic }) => {
	const { app } = useContext(AppContext)

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
				<PeerIdView peerId={app.libp2p.peerId} />
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

	useEffect(() => {
		if (app === null) {
			return
		}

		const handleConnectionOpen = ({ detail: connection }: CustomEvent<Connection>) =>
			void setConnections((connections) => [...connections, connection])

		const handleConnectionClose = ({ detail: connection }: CustomEvent<Connection>) =>
			void setConnections((connections) => connections.filter(({ id }) => connection.id !== id))

		app.libp2p.addEventListener("connection:open", handleConnectionOpen)
		app.libp2p.addEventListener("connection:close", handleConnectionClose)

		return () => {
			app.libp2p.removeEventListener("connection:open", handleConnectionOpen)
			app.libp2p.removeEventListener("connection:close", handleConnectionClose)
		}
	}, [app])

	if (!connections || Object.entries(connections).length === 0) {
		return <div className="italic">No connections</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{connections.map(({ id, remotePeer, remoteAddr }) => {
					return (
						<li key={id}>
							<div>
								<PeerIdView peerId={remotePeer} />
							</div>
							<div>
								<MultiaddrView addr={remoteAddr} peerId={remotePeer} />
							</div>
						</li>
					)
				})}
			</ul>
		)
	}
}
