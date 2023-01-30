import React, { useState } from "react"
import dynamic from "next/dynamic"
import Head from "next/head"

import { Client, useCanvas } from "@canvas-js/hooks"

import { ErrorMessage } from "../components/ErrorMessage"

const Connect = dynamic(() => import("../components/Connect").then(({ Connect }) => Connect), { ssr: false })
const Messages = dynamic(() => import("../components/Messages").then(({ Messages }) => Messages), { ssr: false })

export default function Index({}) {
	const { isLoading, error, data } = useCanvas()

	const [client, setClient] = useState<Client | null>(null)

	const gossipPeers = data?.peers ? Object.entries(data.peers.gossip) : []
	const syncPeers = data?.peers ? Object.entries(data.peers.sync) : []

	return (
		<main>
			<Head>
				<title>Canvas Example App</title>
				<meta name="viewport" content="initial-scale=1.0, width=device-width" />
			</Head>
			<Messages client={client} />
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
								{data.peers && (
									<ul className="tree-view">
										<li>{gossipPeers.length} gossip peers</li>
										<li>
											<ul>
												{gossipPeers.map(([peerId, { lastSeen }]) => (
													<li key={peerId} data-id={peerId} style={{ display: "flex" }}>
														<div style={{ flex: 1 }}>
															{peerId.slice(0, 10) + "..." + peerId.slice(peerId.length - 3)}
														</div>
														<div>{Math.round((Date.now() - lastSeen) / 1000 / 60)}min ago</div>
													</li>
												))}
											</ul>
										</li>
										<li>{syncPeers.length} sync peers</li>
										<li>
											<ul>
												{syncPeers.map(([peerId, { lastSeen }]) => (
													<li key={peerId} data-id={peerId} style={{ display: "flex" }}>
														<div style={{ flex: 1 }}>
															{peerId.slice(0, 10) + "..." + peerId.slice(peerId.length - 3)}
														</div>
														<div>{Math.round((Date.now() - lastSeen) / 1000 / 60)}min ago</div>
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
				<Connect setClient={setClient} />
			</div>
		</main>
	)
}
