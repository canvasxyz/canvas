import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { SubscriptionChangeData } from "@libp2p/interface-pubsub"
import { Connection } from "@libp2p/interface-connection"
import { protocols } from "@multiformats/multiaddr"

// import { createTopology } from "@libp2p/topology"
// import { GossipSub } from "@chainsafe/libp2p-gossipsub"

import closeIcon from "../icons/close.svg"

import { PeerIdToken } from "./PeerId"
import { AppContext } from "../context"

export interface StatusPanelProps {}

export const StatusPanel: React.FC<StatusPanelProps> = (props) => {
	const { manager, peerId } = useContext(AppContext)

	const [started, setStarted] = useState(manager !== null && manager.libp2p.isStarted())
	const [starting, setStarting] = useState(false)
	const [stopping, setStopping] = useState(false)

	const handleClick = useCallback(async () => {
		if (manager === null || starting || stopping) {
			return
		} else if (started) {
			setStopping(true)
			try {
				await manager.stop()
				setStarted(false)
			} catch (err) {
				console.error(err)
			} finally {
				setStopping(false)
			}
		} else {
			setStarting(true)
			try {
				await manager.start()
				setStarted(true)
			} catch (err) {
				console.error(err)
			} finally {
				setStarting(false)
			}
		}
	}, [started, starting, stopping])

	return (
		<div className="basis-auto shrink-0 grow-0 flex flex-col self-stretch items-stretch overflow-y-scroll border-gray-300 border-l">
			<button
				className="py-1 px-2 text-left border-b border-gray-300 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
				disabled={starting || stopping}
				onClick={handleClick}
			>
				{started ? "stop libp2p" : "start libp2p"}
			</button>
			<div className="flex flex-row border-b border-gray-300 items-center">
				{peerId && <PeerIdToken peerId={peerId} />}
			</div>
			{started && <ConnectionsList />}
			{started && <MeshPeerList />}
		</div>
	)
}

interface ConnectionsListProps {}

const ConnectionsList: React.FC<ConnectionsListProps> = (props) => {
	const connectionMap = useMemo(() => new Map<string, Connection>(), [])
	const [connections, setConnections] = useState<Connection[]>([])

	const { manager } = useContext(AppContext)

	useEffect(() => {
		if (manager === null) {
			return
		}

		const { libp2p } = manager
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
	}, [manager])

	return (
		<div>
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
// const webRTCProtocol = protocols("webrtc")

interface ConnectionStatusProps {
	connection: Connection
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = (props) => {
	const type = useMemo(() => {
		const [[code, origin], ...rest] = props.connection.remoteAddr.stringTuples()
		const { name } = protocols(code)

		const isCircuitRelay = rest.some(([code]) => code === circuitRelayProtocol.code)
		// const isWebRTC = rest.some(([code]) => code === webRTCProtocol.code)

		const { direction } = props.connection.stat
		if (isCircuitRelay) {
			return `relayed ${direction} via /${name}/${origin}`
		} else if (direction === "inbound") {
			return `direct inbound from ${origin}`
		} else if (direction === "outbound") {
			return `direct outbound to /${name}/${origin}`
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
			{/* <div className="flex flex-row">
				<div className="p-1">
					<span>
						{type} {props.connection.stat.direction}
					</span>
				</div>
			</div> */}
		</div>
	)
}

interface MeshPeerListProps {}

const MeshPeerList: React.FC<MeshPeerListProps> = (props) => {
	const topicSubscriptionMap = useMemo(() => new Map<string, Set<string>>(), [])
	const [topicPeers, setTopicPeers] = useState<{ topic: string; peers: string[] }[]>([])

	const { peerId, manager } = useContext(AppContext)

	useEffect(() => {
		if (peerId === null || manager === null) {
			return
		}

		const { pubsub } = manager.libp2p.services

		const topicPrefix = "/canvas/v0/store/"
		const topicPeers: { topic: string; peers: string[] }[] = []
		for (const topic of pubsub.getTopics()) {
			const peers = pubsub.getSubscribers(topic).map((peerId) => peerId.toString())
			topicSubscriptionMap.set(topic, new Set(peers))
			if (topic.startsWith(topicPrefix)) {
				topicPeers.push({ topic: topic.slice(topicPrefix.length), peers })
			}
		}

		setTopicPeers(topicPeers)

		const handleSubscriptionChange = ({ detail: { peerId, subscriptions } }: CustomEvent<SubscriptionChangeData>) => {
			if (peerId.equals(peerId)) {
				for (const { subscribe, topic } of subscriptions) {
					if (subscribe) {
						const peers = pubsub.getSubscribers(topic).map((peerId) => peerId.toString())
						topicSubscriptionMap.set(topic, new Set(peers))
					} else {
						topicSubscriptionMap.delete(topic)
					}
				}
			} else {
				for (const { subscribe, topic } of subscriptions) {
					const peers = topicSubscriptionMap.get(topic)
					if (peers === undefined) {
						continue
					} else if (subscribe) {
						peers.add(peerId.toString())
					} else {
						peers.delete(peerId.toString())
					}
				}
			}

			const topicPeers: { topic: string; peers: string[] }[] = []
			for (const [topic, peers] of topicSubscriptionMap) {
				if (topic.startsWith(topicPrefix)) {
					topicPeers.push({ topic: topic.slice(topicPrefix.length), peers: [...peers] })
				}
			}

			setTopicPeers(topicPeers)
		}

		pubsub.addEventListener("subscription-change", handleSubscriptionChange)
		return () => {
			pubsub.removeEventListener("subscription-change", handleSubscriptionChange)
		}
	}, [peerId, manager])

	return (
		<div>
			<h4 className="p-1 border-b border-gray-300 font-bold">GossipSub mesh peers</h4>
			{topicPeers.length > 0 ? (
				topicPeers.map(({ topic, peers }) => <TopicPeersList key={topic} topic={topic} peers={peers} />)
			) : (
				<div className="p-1 italic">No topics</div>
			)}
		</div>
	)
}

interface TopicPeersListProps {
	topic: string
	peers: string[]
}

const TopicPeersList: React.FC<TopicPeersListProps> = (props) => {
	return (
		<div className="flex flex-col border-b border-gray-300">
			<div className="p-1">{props.topic}</div>
			<div className="flex flex-col">
				{props.peers.map((peerId) => (
					<code className="m-1 text-sm font-mono" key={peerId}>
						- {peerId}
					</code>
				))}
			</div>
		</div>
	)
}
