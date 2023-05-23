import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { SubscriptionChangeData } from "@libp2p/interface-pubsub"
import { Connection } from "@libp2p/interface-connection"
import { protocols } from "@multiformats/multiaddr"
import { PeerId } from "@libp2p/interface-peer-id"

// import { createTopology } from "@libp2p/topology"
// import { GossipSub } from "@chainsafe/libp2p-gossipsub"

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
		<div className="basis-auto shrink-0 flex flex-col self-stretch items-stretch overflow-y-scroll border-gray-300 border-l">
			<button
				className="py-1 px-2 text-left border-b border-gray-300 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
				disabled={starting || stopping}
				onClick={handleClick}
			>
				{started ? "stop libp2p" : "start libp2p"}
			</button>
			<div className="flex flex-row border-b border-gray-300 items-center">
				<PeerIdToken peerId={libp2p.peerId} />
			</div>
			{started && <ConnectionsList />}
			{/* {started && <MeshPeerList />} */}
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
const webRTCProtocol = protocols("webrtc")

interface ConnectionStatusProps {
	connection: Connection
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = (props) => {
	const [origin, type] = useMemo(() => {
		const [[code, origin], ...rest] = props.connection.remoteAddr.stringTuples()
		const { name } = protocols(code)

		const isCircuitRelay = rest.some(([code]) => code === circuitRelayProtocol.code)
		const isWebRTC = rest.some(([code]) => code === webRTCProtocol.code)

		return [`/${name}/${origin}`, isWebRTC ? "WebRTC" : isCircuitRelay ? "relayed" : "direct"]
	}, [props.connection])

	return (
		<div className="flex flex-col items-end border-b border-gray-300">
			<PeerIdToken peerId={props.connection.remotePeer} />
			<div className="p-1">
				{type} {props.connection.stat.direction} {props.connection.remoteAddr.decapsulateCode(421).toString()}
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

// interface MeshPeerListProps {}

// const MeshPeerList: React.FC<MeshPeerListProps> = (props) => {
// 	const peerSubscriptionMap = useMemo(() => new Map<string, Set<string>>(), [])

// 	// const [topicPeers, setTopicPeers] = useState<{ topic: string; peers: PeerId[] }[]>([])

// 	useEffect(() => {
// 		const { pubsub } = libp2p.services

// 		// const topicPrefix = "/canvas/v0/store/"

// 		const handleSubscriptionChange = ({ detail: { peerId, subscriptions } }: CustomEvent<SubscriptionChangeData>) => {
// 			const subscriptionSet = peerSubscriptionMap.get(peerId.toString())
// 			if (subscriptionSet === undefined) {
// 				const subscriptionSet = new Set<string>()
// 				for (const { subscribe, topic } of subscriptions) {
// 					if (subscribe) {
// 						subscriptionSet.add(topic)
// 					}
// 				}

// 				if (subscriptionSet.size > 0) {
// 					peerSubscriptionMap.set(peerId.toString(), subscriptionSet)
// 				}
// 			} else {
// 				for (const { subscribe, topic } of subscriptions) {
// 					if (subscribe) {
// 						subscriptionSet.add(topic)
// 					} else {
// 						subscriptionSet.delete(topic)
// 					}
// 				}

// 				if (subscriptionSet.size === 0) {
// 					peerSubscriptionMap.delete(peerId.toString())
// 				}
// 			}
// 		}

// 		pubsub.addEventListener("subscription-change", handleSubscriptionChange)
// 		return () => {
// 			pubsub.removeEventListener("subscription-change", handleSubscriptionChange)
// 		}
// 	}, [])

// 	return (
// 		<div>
// 			<h4 className="p-1 border-b border-gray-300 font-bold">GossipSub mesh peers</h4>
// 			{topicPeers.length > 0 ? (
// 				topicPeers.map(({ topic, peers }) => <TopicPeersList key={topic} topic={topic} peers={peers} />)
// 			) : (
// 				<div className="p-1 italic">No topics</div>
// 			)}
// 		</div>
// 	)
// }

interface TopicPeersListProps {
	topic: string
	peers: PeerId[]
}

const TopicPeersList: React.FC<TopicPeersListProps> = (props) => {
	return (
		<div className="flex flex-col border-b border-gray-300">
			<div className="p-1">{props.topic}</div>
			<div className="flex flex-col">
				{props.peers.map((peer) => (
					<code className="m-1 text-sm font-mono" key={peer.toString()}>
						- {peer.toString()}
					</code>
				))}
			</div>
		</div>
	)
}
