import React from "react"

import type { PeerId } from "@libp2p/interface/peer-id"

export interface PeerIdViewProps {
	className?: string
	peerId: PeerId
}

export const PeerIdView: React.FC<PeerIdViewProps> = (props) => {
	const className = props.className ?? "text-sm"
	const id = props.peerId.toString()
	return (
		<code className={className}>
			{/* {id.slice(0, 12)}…{id.slice(-4)} */}
			{id}
		</code>
	)
}
