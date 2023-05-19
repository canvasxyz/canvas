import React, { useCallback, useState } from "react"

import { libp2p } from "../stores/libp2p"
import { PeerIdToken } from "./PeerId"

export interface StatusPanelProps {}

export const StatusPanel: React.FC<StatusPanelProps> = (props) => {
	const [started, setStarted] = useState(libp2p.isStarted())
	const [starting, setStarting] = useState(false)
	const [stopping, setStopping] = useState(false)

	const handleClick = useCallback(async () => {
		if (starting || stopping) {
			return
		} else if (started) {
			setStopping(true)
			try {
				await libp2p.stop()
				setStarted(false)
			} catch (err) {
				console.error(err)
			} finally {
				setStopping(false)
			}
		} else {
			setStarting(true)
			try {
				await libp2p.start()
				setStarted(true)
			} catch (err) {
				console.error(err)
			} finally {
				setStarting(false)
			}
		}
	}, [started, starting, stopping])

	return (
		<div>
			<div className="w-full flex border-gray-300 border-t border-b items-center">
				<button
					className="py-1 px-2 w-full text-left border-r border-gray-300 bg-gray-100 hover:cursor-pointer hover:bg-gray-200 active:bg-gray-300"
					disabled={starting || stopping}
					onClick={handleClick}
				>
					{started ? "stop libp2p" : "start libp2p"}
				</button>
				<PeerIdToken peerId={libp2p.peerId} className="py-1 px-2" />
			</div>
		</div>
	)
}
