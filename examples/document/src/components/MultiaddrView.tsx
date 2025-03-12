import React from "react"

import type { PeerId } from "@libp2p/interface"
import type { Multiaddr } from "@multiformats/multiaddr"

export interface MultiaddrViewProps {
	addr: Multiaddr
	peerId?: PeerId
}

export const MultiaddrView: React.FC<MultiaddrViewProps> = (props) => {
	let address = props.addr.toString()
	if (props.peerId && address.endsWith(`/p2p/${props.peerId}`)) {
		address = address.slice(0, address.lastIndexOf("/p2p/"))
	}

	if (address.endsWith("/p2p-circuit/webrtc")) {
		return <code className="text-sm break-all text-gray-500">/webrtc</code>
	} else {
		return <code className="text-sm break-all text-gray-500">{address}</code>
	}
}
