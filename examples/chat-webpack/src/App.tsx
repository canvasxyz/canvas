import React, { useState } from "react"
import { Connect } from "./Connect"

import { Client, useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { Messages } from "./Messages"
import { AppContext } from "./AppContext"

const second = 1000
const minute = 60 * second

export const App: React.FC<{}> = ({}) => {
	const { isLoading, error, data } = useCanvas()

	const [client, setClient] = useState<Client | null>(null)

	const gossipPeers = data?.peers ? Object.entries(data.peers.gossip) : []
	const syncPeers = data?.peers ? Object.entries(data.peers.sync) : []

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
								<p>{data.uri}</p>
								<p data-id={data.peerId}>Host Peer ID: {data.peerId}</p>
								{data.peers && (
									<ul className="tree-view">
										<li>{gossipPeers.length} gossip peers</li>
										<li>
											<ul>
												{gossipPeers.map(([peerId, { lastSeen }]) => (
													<li key={peerId} data-id={peerId} style={{ display: "flex" }}>
														<div style={{ flex: 1 }}>{peerId}</div>
														<div>{Math.round((Date.now() - lastSeen) / minute)}min ago</div>
													</li>
												))}
											</ul>
										</li>
										<li>{syncPeers.length} sync peers</li>
										<li>
											<ul>
												{syncPeers.map(([peerId, { lastSeen }]) => (
													<li key={peerId} data-id={peerId} style={{ display: "flex" }}>
														<div style={{ flex: 1 }}>{peerId}</div>
														<div>{Math.round((Date.now() - lastSeen) / minute)}min ago</div>
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
