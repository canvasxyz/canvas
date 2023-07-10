import React from "react";
import { protocolPrefix } from "@canvas-js/store";
import { PeerIdToken } from "./PeerIdToken.js";
import { ConnectionList } from "./ConnectionList.js";
import { PubsubPeerList } from "./PubsubPeerList.js";
import { libp2p } from "../libp2p.js";
export const StatusPanel = () => {
    return (React.createElement("div", { className: "overflow-y-scroll flex flex-col items-stretch bg-gray-100 border-l border-gray-300" },
        React.createElement("div", { className: "flex flex-row border-b border-gray-300 items-center" }, libp2p.peerId && React.createElement(PeerIdToken, { peerId: libp2p.peerId })),
        React.createElement(ConnectionList, null),
        React.createElement(PubsubPeerList, { protocolPrefix: protocolPrefix })));
};
