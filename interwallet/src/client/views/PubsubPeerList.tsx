import React, { useEffect, useState } from "react"

import { SubscriptionChangeData } from "@libp2p/interface-pubsub"

import { libp2p } from "../libp2p.js"

export interface PubsubPeerListProps {
	className?: string
	protocolPrefix?: string
}

export const PubsubPeerList: React.FC<PubsubPeerListProps> = ({ className, protocolPrefix }) => {
	const [topicPeers, setTopicPeers] = useState<{ topic: string; peers: string[] }[]>([])

	useEffect(() => {
		const updateTopicPeers = () => {
			const topicPeers: { topic: string; peers: string[] }[] = []
			const topics = libp2p.services.pubsub.getTopics()
			for (const topic of topics) {
				const peers = libp2p.services.pubsub.getSubscribers(topic).map((peerId) => peerId.toString())
				if (protocolPrefix === undefined) {
					topicPeers.push({ topic, peers })
				} else if (topic.startsWith(protocolPrefix)) {
					topicPeers.push({ topic: topic.slice(protocolPrefix.length), peers })
				}
			}

			setTopicPeers(topicPeers)
		}

		const handleSubscriptionChange = ({ detail: update }: CustomEvent<SubscriptionChangeData>) => {
			updateTopicPeers()
		}

		libp2p.services.pubsub.addEventListener("subscription-change", handleSubscriptionChange)

		updateTopicPeers()

		return () => {
			libp2p.services.pubsub.removeEventListener("subscription-change", handleSubscriptionChange)
		}
	}, [])

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
