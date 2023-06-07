import React, { useEffect, useMemo, useState } from "react"

import { Libp2p } from "@libp2p/interface-libp2p"
import { Connection } from "@libp2p/interface-connection"
import { protocols } from "@multiformats/multiaddr"

import { ReactComponent as closeIcon } from "../../../icons/close.svg"

import { PeerIdToken } from "./PeerIdToken.js"

export interface ConnectionListProps {
	className?: string
	libp2p: Libp2p | null
}

export const ConnectionList: React.FC<ConnectionListProps> = ({ className, libp2p }) => {
	const connectionMap = useMemo(() => new Map<string, Connection>(), [])
	const [connections, setConnections] = useState<Connection[]>([])

	useEffect(() => {
		if (libp2p === null) {
			return
		}

		for (const connection of libp2p.getConnections()) {
			connectionMap.set(connection.id, connection)
		}

		setConnections([...connectionMap.values()])

		const handleOpenConnection = ({ detail: connection }: CustomEvent<Connection>) => {
			connectionMap.set(connection.id, connection)
			setConnections([...connectionMap.values()])
		}

		const handleCloseConnection = ({ detail: { id } }: CustomEvent<Connection>) => {
			connectionMap.delete(id)
			setConnections([...connectionMap.values()])
		}

		libp2p.addEventListener("connection:open", handleOpenConnection)
		libp2p.addEventListener("connection:close", handleCloseConnection)

		return () => {
			libp2p.removeEventListener("connection:open", handleCloseConnection)
			libp2p.removeEventListener("connection:close", handleCloseConnection)
		}
	}, [libp2p])

	return (
		<div className={className}>
			<h4 className="p-1 border-b border-gray-300 font-bold">Connections</h4>
			{connections.length > 0 ? (
				connections.map((connection) => <ConnectionStatus key={connection.id} connection={connection} />)
			) : (
				<div className="p-1 italic">No connections</div>
			)}
		</div>
	)
}

const circuitRelayProtocol = protocols("p2p-circuit")
const webRTCProtocol = protocols("webrtc")

interface ConnectionStatusProps {
	connection: Connection
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = (props) => {
	const type = useMemo(() => {
		const [[code, origin], ...rest] = props.connection.remoteAddr.stringTuples()
		const { name } = protocols(code)

		const isCircuitRelay = rest.some(([code]) => code === circuitRelayProtocol.code)
		const isWebRTC = rest.some(([code]) => code === webRTCProtocol.code)

		const { direction } = props.connection.stat
		if (isWebRTC) {
			return `${direction} WebRTC`
		} else if (isCircuitRelay) {
			return `${direction} relayed via /${name}/${origin}`
		} else if (direction === "inbound") {
			return `inbound direct from /${name}/${origin}`
		} else if (direction === "outbound") {
			return `outbound direct to /${name}/${origin}`
		}
	}, [props.connection])

	return (
		<div className="flex flex-col items-end border-b border-gray-300">
			<PeerIdToken peerId={props.connection.remotePeer} />
			<div className="flex flex-row items-center">
				<div className="p-1">{type}</div>
				<button
					className="p-1 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
					onClick={() => props.connection.close()}
				>
					{closeIcon({ width: 24, height: 24 })}
				</button>
			</div>
		</div>
	)
}
