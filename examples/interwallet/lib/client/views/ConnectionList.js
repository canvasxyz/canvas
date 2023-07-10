import React, { useEffect, useMemo, useState } from "react";
import { protocols } from "@multiformats/multiaddr";
import { ReactComponent as closeIcon } from "../../../icons/close.svg";
import { PeerIdToken } from "./PeerIdToken.js";
import { libp2p } from "../libp2p.js";
export const ConnectionList = ({ className }) => {
    const connectionMap = useMemo(() => new Map(), []);
    const [connections, setConnections] = useState([]);
    useEffect(() => {
        for (const connection of libp2p.getConnections()) {
            connectionMap.set(connection.id, connection);
        }
        setConnections([...connectionMap.values()]);
        const handleOpenConnection = ({ detail: connection }) => {
            connectionMap.set(connection.id, connection);
            setConnections([...connectionMap.values()]);
        };
        const handleCloseConnection = ({ detail: { id } }) => {
            connectionMap.delete(id);
            setConnections([...connectionMap.values()]);
        };
        libp2p.addEventListener("connection:open", handleOpenConnection);
        libp2p.addEventListener("connection:close", handleCloseConnection);
        return () => {
            libp2p.removeEventListener("connection:open", handleCloseConnection);
            libp2p.removeEventListener("connection:close", handleCloseConnection);
        };
    }, [libp2p]);
    return (React.createElement("div", { className: className },
        React.createElement("h4", { className: "p-1 border-b border-gray-300 font-bold" }, "Connections"),
        connections.length > 0 ? (connections.map((connection) => React.createElement(ConnectionStatus, { key: connection.id, connection: connection }))) : (React.createElement("div", { className: "p-1 italic" }, "No connections"))));
};
const circuitRelayProtocol = protocols("p2p-circuit");
const webRTCProtocol = protocols("webrtc");
const ConnectionStatus = (props) => {
    const type = useMemo(() => {
        const [[code, origin], ...rest] = props.connection.remoteAddr.stringTuples();
        const { name } = protocols(code);
        const isCircuitRelay = rest.some(([code]) => code === circuitRelayProtocol.code);
        const isWebRTC = rest.some(([code]) => code === webRTCProtocol.code);
        const { direction } = props.connection.stat;
        if (isWebRTC) {
            return `${direction} WebRTC`;
        }
        else if (isCircuitRelay) {
            return `${direction} relayed via /${name}/${origin}`;
        }
        else if (direction === "inbound") {
            return `inbound direct from /${name}/${origin}`;
        }
        else if (direction === "outbound") {
            return `outbound direct to /${name}/${origin}`;
        }
    }, [props.connection]);
    return (React.createElement("div", { className: "flex flex-col items-end border-b border-gray-300" },
        React.createElement(PeerIdToken, { peerId: props.connection.remotePeer }),
        React.createElement("div", { className: "flex flex-row items-center" },
            React.createElement("div", { className: "p-1" }, type),
            React.createElement("button", { className: "p-1 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300", onClick: () => props.connection.close() }, closeIcon({ width: 24, height: 24 })))));
};
