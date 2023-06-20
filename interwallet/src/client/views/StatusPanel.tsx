import React, { useCallback, useContext, useState } from "react"

import { protocolPrefix } from "@canvas-js/store"

import { PeerIdToken } from "./PeerIdToken.js"
import { ConnectionList } from "./ConnectionList.js"
import { PubsubPeerList } from "./PubsubPeerList.js"
import { Libp2p } from "libp2p"
import { ServiceMap } from "../libp2p.js"

export const StatusPanel = ({ libp2p }: { libp2p: Libp2p<ServiceMap> }) => {
	// const { manager, peerId } = useContext(AppContext)

	// const [starting, setStarting] = useState(false)
	// const [stopping, setStopping] = useState(false)

	// const handleClick = useCallback(async () => {
	// 	if (manager === null || starting || stopping) {
	// 		return
	// 	} else if (manager.isStarted()) {
	// 		setStopping(true)
	// 		try {
	// 			await manager.stop()
	// 		} catch (err) {
	// 			console.error(err)
	// 		} finally {
	// 			setStopping(false)
	// 		}
	// 	} else {
	// 		setStarting(true)
	// 		try {
	// 			await manager.start()
	// 		} catch (err) {
	// 			console.error(err)
	// 		} finally {
	// 			setStarting(false)
	// 		}
	// 	}
	// }, [starting, stopping, manager])

	// const started = manager !== null && manager.isStarted()

	return (
		<div className="overflow-y-scroll flex flex-col items-stretch bg-gray-100 border-l border-gray-300">
			{/* <button
				className="py-1 px-2 text-left border-b border-gray-300 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
				disabled={starting || stopping}
				onClick={handleClick}
			>
				{started ? "stop libp2p" : "start libp2p"}
			</button> */}
			<div className="flex flex-row border-b border-gray-300 items-center">
				{libp2p.peerId && <PeerIdToken peerId={libp2p.peerId} />}
			</div>
			{<ConnectionList libp2p={libp2p} />}
			{<PubsubPeerList libp2p={libp2p} protocolPrefix={protocolPrefix} />}
		</div>
	)
}
