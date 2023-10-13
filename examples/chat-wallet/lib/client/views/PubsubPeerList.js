import React, { useEffect, useState } from "react";
import { libp2p } from "../libp2p.js";
export const PubsubPeerList = ({ className, protocolPrefix }) => {
    const [topicPeers, setTopicPeers] = useState([]);
    useEffect(() => {
        const updateTopicPeers = () => {
            const topicPeers = [];
            const topics = libp2p.services.pubsub.getTopics();
            for (const topic of topics) {
                const peers = libp2p.services.pubsub.getSubscribers(topic).map((peerId) => peerId.toString());
                if (protocolPrefix === undefined) {
                    topicPeers.push({ topic, peers });
                }
                else if (topic.startsWith(protocolPrefix)) {
                    topicPeers.push({ topic: topic.slice(protocolPrefix.length), peers });
                }
            }
            setTopicPeers(topicPeers);
        };
        const handleSubscriptionChange = ({ detail: update }) => {
            updateTopicPeers();
        };
        libp2p.services.pubsub.addEventListener("subscription-change", handleSubscriptionChange);
        updateTopicPeers();
        return () => {
            libp2p.services.pubsub.removeEventListener("subscription-change", handleSubscriptionChange);
        };
    }, []);
    return (React.createElement("div", { className: className },
        React.createElement("h4", { className: "p-1 border-b border-gray-300 font-bold" }, "PubSub topic peers"),
        topicPeers.length > 0 ? (topicPeers.map(({ topic, peers }) => React.createElement(TopicPeersList, { key: topic, topic: topic, peers: peers }))) : (React.createElement("div", { className: "p-1 italic" }, "No topics"))));
};
const TopicPeersList = (props) => {
    return (React.createElement("div", { className: "flex flex-col border-b border-gray-300" },
        React.createElement("div", { className: "p-1" }, props.topic),
        React.createElement("div", { className: "flex flex-col" }, props.peers.length === 0 ? (React.createElement("span", { className: "m-1 italic" }, "No peers")) : (props.peers.map((peerId) => (React.createElement("code", { className: "m-1 text-sm font-mono", key: peerId },
            "- ",
            peerId)))))));
};
