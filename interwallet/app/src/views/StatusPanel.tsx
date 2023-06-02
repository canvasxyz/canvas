import React, { useCallback, useContext, useState } from "react"

import { protocolPrefix } from "@canvas-js/store"

import { PeerIdToken, ConnectionList, PubsubPeerList } from "@canvas-js/libp2p-status-components"

import { AppContext } from "../context.js"

export interface StatusPanelProps {}

export const StatusPanel: React.FC<StatusPanelProps> = (props) => {
	const { manager, peerId } = useContext(AppContext)

	const [starting, setStarting] = useState(false)
	const [stopping, setStopping] = useState(false)

	const handleClick = useCallback(async () => {
		if (manager === null || starting || stopping) {
			return
		} else if (manager.isStarted()) {
			setStopping(true)
			try {
				await manager.stop()
			} catch (err) {
				console.error(err)
			} finally {
				setStopping(false)
			}
		} else {
			setStarting(true)
			try {
				await manager.start()
			} catch (err) {
				console.error(err)
			} finally {
				setStarting(false)
			}
		}
	}, [starting, stopping, manager])

	const started = manager !== null && manager.isStarted()

	return (
		<div className="overflow-y-scroll flex flex-col items-stretch bg-gray-100 border-l border-gray-300">
			<button
				className="py-1 px-2 text-left border-b border-gray-300 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
				disabled={starting || stopping}
				onClick={handleClick}
			>
				{started ? "stop libp2p" : "start libp2p"}
			</button>
			<div className="flex flex-row border-b border-gray-300 items-center">
				{peerId && <PeerIdToken peerId={peerId} />}
			</div>
			{started && <ConnectionList libp2p={manager.libp2p} />}
			{started && <PubsubPeerList libp2p={manager.libp2p} protocolPrefix={protocolPrefix} />}
		</div>
	)
}
