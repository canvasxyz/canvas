import React, { useEffect, useState } from "react"

import { Libp2p } from "@libp2p/interface-libp2p"
import { PubSub, SubscriptionChangeData } from "@libp2p/interface-pubsub"

export interface PubsubPeerListProps {
	className?: string
	protocolPrefix?: string
	libp2p: Libp2p<{ pubsub: PubSub }> | null
}

export const PubsubPeerList: React.FC<PubsubPeerListProps> = ({ className, protocolPrefix, libp2p }) => {
	const [topicPeers, setTopicPeers] = useState<{ topic: string; peers: string[] }[]>([])

	const updateTopicPeers = () => {
		if (libp2p === null) return

		const { pubsub } = libp2p.services

		const topicPeers: { topic: string; peers: string[] }[] = []
		const topics = pubsub.getTopics()
		for (const topic of topics) {
			const peers = pubsub.getSubscribers(topic).map((peerId) => peerId.toString())
			if (protocolPrefix === undefined) {
				topicPeers.push({ topic, peers })
			} else if (topic.startsWith(protocolPrefix)) {
				topicPeers.push({ topic: topic.slice(protocolPrefix.length), peers })
			}
		}

		setTopicPeers(topicPeers)
	}

	useEffect(() => {
		if (libp2p === null) {
			return
		}

		const handleSubscriptionChange = ({ detail: update }: CustomEvent<SubscriptionChangeData>) => {
			updateTopicPeers()
		}

		const { pubsub } = libp2p.services
		pubsub.addEventListener("subscription-change", handleSubscriptionChange)

		updateTopicPeers()

		return () => {
			pubsub.removeEventListener("subscription-change", handleSubscriptionChange)
		}
	}, [libp2p])

	return (
		<div className={className}>
			<h4 className="p-1 border-b border-gray-300 font-bold">PubSub topic peers</h4>
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
				{props.peers.length === 0 ? (
					<span className="m-1 italic">No peers</span>
				) : (
					props.peers.map((peerId) => (
						<code className="m-1 text-sm font-mono" key={peerId}>
							- {peerId}
						</code>
					))
				)}
			</div>
		</div>
	)
}
