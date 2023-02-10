import React, { useState } from "react"
import { Connect } from "./Connect"

import { Client, useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { Messages } from "./Messages"
import { AppContext } from "./AppContext"

const second = 1000
const minute = 60 * second

export const App: React.FC<{}> = () => {
	const { isLoading, error, data } = useCanvas()

	const [client, setClient] = useState<Client | null>(null)

	const gossipPeers = data?.peers ? Object.entries(data.peers.gossip) : []
	const syncPeers = data?.peers ? Object.entries(data.peers.sync) : []

	const now = Date.now()
	console.log(data)
	const root = data && data.merkleRoots && data.merkleRoots[data.uri]

	return (
		<AppContext.Provider value={{ client, setClient }}>
			<Messages />
			<div id="sidebar">
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
								{root && <p>Merkle root: {root}</p>}
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
								)}
							</div>
						) : null}
					</div>
				</div>
				<Connect />
			</div>
		</AppContext.Provider>
	)
}
