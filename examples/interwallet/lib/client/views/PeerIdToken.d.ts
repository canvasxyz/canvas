import React from "react";
import { PeerId } from "@libp2p/interface-peer-id";
export interface PeerIdTokenProps {
    peerId: PeerId;
    compact?: boolean;
    className?: string;
    children?: React.ReactNode;
}
export declare const PeerIdToken: (props: PeerIdTokenProps) => React.JSX.Element;
