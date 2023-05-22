import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Connection } from "@libp2p/interface-connection"
import { protocols } from "@multiformats/multiaddr"

import { libp2p } from "../stores/libp2p"
import { PeerIdToken } from "./PeerId"

export interface StatusPanelProps {}

export const StatusPanel: React.FC<StatusPanelProps> = (props) => {
	const [started, setStarted] = useState(libp2p.isStarted())
	const [starting, setStarting] = useState(false)
	const [stopping, setStopping] = useState(false)

	const handleClick = useCallback(async () => {
		if (starting || stopping) {
			return
		} else if (started) {
			setStopping(true)
			try {
				await libp2p.stop()
				setStarted(false)
			} catch (err) {
				console.error(err)
			} finally {
				setStopping(false)
			}
		} else {
			setStarting(true)
			try {
				await libp2p.start()
				setStarted(true)
			} catch (err) {
				console.error(err)
			} finally {
				setStarting(false)
			}
		}
	}, [started, starting, stopping])

	return (
		<div className="basis-96 grow-0 shrink-0 flex flex-col self-stretch items-stretch border-gray-300 border-l">
			<button
				className="py-1 px-2 text-left border-b border-gray-300 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
				disabled={starting || stopping}
				onClick={handleClick}
			>
				{started ? "stop libp2p" : "start libp2p"}
			</button>
			<div className="flex flex-row border-b border-gray-300 items-center">
				<h4 className="py-1 px-2 grow border-r border-gray-300">Peer Id</h4>
				<PeerIdToken compact peerId={libp2p.peerId} />
			</div>
			{started && <ConnectionsList />}
		</div>
	)
}

interface ConnectionsListProps {}

const ConnectionsList: React.FC<ConnectionsListProps> = (props) => {
	const connectionMap = useMemo(() => new Map<string, Connection>(), [])
	const [connections, setConnections] = useState<Connection[]>([])

	useEffect(() => {
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
	}, [])

	return (
		<div className="pl-2">
			<h4 className="py-1 border-b border-gray-300">Connections</h4>
			{connections.length > 0 ? (
				connections.map((connection) => <ConnectionStatus key={connection.id} connection={connection} />)
			) : (
				<div className="my-1 italic">No connections</div>
			)}
		</div>
	)
}

const circuitRelayProtocol = protocols("p2p-circuit")

interface ConnectionStatusProps {
	connection: Connection
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = (props) => {
	const [origin, isRelayConnection] = useMemo(() => {
		const [[code, origin], ...rest] = props.connection.remoteAddr.stringTuples()
		const { name } = protocols(code)
		return [`/${name}/${origin}`, rest.some(([code]) => code === circuitRelayProtocol.code)]
	}, [props.connection])

	return (
		<div className="my-1 flex flex-col items-end border-b border-gray-300">
			<div className="my-1 mx-2">{origin}</div>
			<div className="flex flex-row">
				<div className="py-1 mx-2 whitespace-pre">
					<span>{props.connection.stat.direction}</span>, <span>{isRelayConnection ? "relayed" : "direct"}</span>
				</div>
				<PeerIdToken compact peerId={props.connection.remotePeer} />
			</div>
		</div>
	)
}
