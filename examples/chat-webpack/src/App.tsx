import React from "react"
import { Connect } from "./Connect"

import { useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "./ErrorMessage"
import { Messages } from "./Messages"

export const App: React.FC<{}> = ({}) => {
	const { isLoading, error, data, host } = useCanvas()

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
							<>
								<p>{data.uri}</p>
								<p data-id={data.peerId}>
									Peer ID: {data.peerId?.slice(0, 10)}...{data.peerId?.slice(data.peerId?.length - 3)}
								</p>
								<ul className="tree-view">
									<li>
										{data.peers?.length} peers
										<ul>
											{data.peers.map((peer) => (
												<li key={peer} data-id={peer}>
													{peer.slice(0, 10)}...{peer.slice(peer.length - 3)}
												</li>
											))}
										</ul>
									</li>
								</ul>
							</>
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
