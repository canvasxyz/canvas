import React from "react"
import { Connect } from "./Connect"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { Messages } from "./Messages"

export const App: React.FC<{}> = ({}) => {
	const { isLoading, error, data, host } = useCanvas()

	const gossipPeers = data?.peers ? Object.entries(data.peers.gossip) : []
	const backlogPeers = data?.peers ? Object.entries(data.peers.backlog) : []

	return (
		<>
			<Messages />
			<div id="sidebar">
				<div className="window">
					<div className="title-bar">
						<div className="title-bar-text">Application</div>
					</div>
					<div className="window-body">
						{isLoading ? (
							<p>Loading...</p>
						) : data ? (
							<div>
								<p>{data.uri}</p>
								<p data-id={data.peerId}>
									Peer ID: {data.peerId?.slice(0, 10)}...{data.peerId?.slice(data.peerId?.length - 3)}
								</p>
								{data.peers && (
									<ul className="tree-view">
										<li>{gossipPeers.length + " gossip peers"}</li>
										<li>
											<ul>
												{gossipPeers.map(([peerId, { lastSeen }]) => (
													<li key={peerId} data-id={peerId}>
														{peerId.slice(0, 10) + "..." + peerId.slice(peerId.length - 3)}
													</li>
												))}
											</ul>
										</li>
										<li>{backlogPeers.length + " backlog sync peers"}</li>
										<li>
											<ul>
												{backlogPeers.map(([peerId, { lastSeen }]) => (
													<li key={peerId} data-id={peerId}>
														{peerId.slice(0, 10) + "..." + peerId.slice(peerId.length - 3)}
													</li>
												))}
											</ul>
										</li>
									</ul>
								)}
							</div>
						) : (
							<ErrorMessage error={error} />
						)}
					</div>
				</div>
				<Connect />
			</div>
		</>
	)
}
