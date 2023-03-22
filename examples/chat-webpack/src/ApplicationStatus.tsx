import React from "react"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"

const second = 1000
const minute = 60 * second

export const ApplicationStatus: React.FC<{}> = ({}) => {
	const { isLoading, error, data } = useCanvas()

	return (
		<div className="window">
			<div className="title-bar">
				<div className="title-bar-text">Application</div>
			</div>
			<div className="window-body">
				{error !== null ? (
					<ErrorMessage error={error} />
				) : isLoading ? (
					<p>Loading...</p>
				) : data ? (
					<div>
						<p>App: {data.uri}</p>
						{data.peerId && <p data-id={data.peerId}>Host: {data.peerId}</p>}
						{/* {root && <p>Merkle root: {root}</p>}
						{data.peers && (
							<ul className="tree-view">
								<li>{gossipPeers.length} gossip peers</li>
								<li>
									<ul id="gossip-peers">
										{gossipPeers.map(([peerId, { lastSeen }]) => (
											<li key={peerId} data-id={peerId} style={{ display: "block" }}>
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
											<li key={peerId} data-id={peerId} style={{ display: "block" }}>
												<div className="peer-id">{peerId}</div>
												<div className="last-seen">last seen {Math.round((now - lastSeen) / minute)}min ago</div>
											</li>
										))}
									</ul>
								</li>
							</ul>
						)} */}
					</div>
				) : null}
			</div>
		</div>
	)
}
