import React from "react"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "../components/ErrorMessage"

const second = 1000
const minute = 60 * second

export function Application() {
	const { isLoading, error, data } = useCanvas()

	const gossipPeers = data?.peers ? Object.entries(data.peers.gossip) : []
	const syncPeers = data?.peers ? Object.entries(data.peers.sync) : []

	const now = Date.now()

	return (
		<div className="window">
			<div className="title-bar">
				<div className="title-bar-text">Application</div>
			</div>
			<div className="window-body">
				{isLoading ? (
					<p>Loading...</p>
				) : data ? (
					<>
						<p>App: {data.uri}</p>
						{data.peerId && <p data-id={data.peerId}>Host: {data.peerId}</p>}
						{data.peers && (
							<ul className="tree-view">
								<li>{gossipPeers.length} gossip peers</li>
								<li>
									<ul id="gossip-peers">
										{gossipPeers.map(([peerId, { lastSeen }]) => (
											<li key={peerId} data-id={peerId}>
												<div className="peer-id">{peerId}</div>
												<div className="last-seen">last seen {Math.round((now - lastSeen) / minute)}min ago</div>
											</li>
										))}
									</ul>
								</li>
								<li>{syncPeers.length} sync peers</li>
								<li>
									<ul id="sync-peers">
										{syncPeers.map(([peerId, { lastSeen }]) => (
											<li key={peerId} data-id={peerId}>
												<div className="peer-id">{peerId}</div>
												<div className="last-seen">last seen {Math.round((now - lastSeen) / minute)}min ago</div>
											</li>
										))}
									</ul>
								</li>
							</ul>
						)}
					</>
				) : (
					<ErrorMessage error={error} />
				)}
			</div>
		</div>
	)
}
