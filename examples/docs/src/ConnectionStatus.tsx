import React, { useContext, useEffect, useState } from "react"

import type { Canvas } from "@canvas-js/core"

import { AppContext } from "./AppContext.js"

export interface ConnectionStatusProps {
	topic: string
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ topic }) => {
	const { app } = useContext(AppContext)

	if (app === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2">
			<div>
				<span className="text-sm">Topic</span>
			</div>
			<div>
				<code className="text-sm">{topic}</code>
			</div>

			<hr />
			<div>
				<span className="text-sm">Connections</span>
			</div>
			<ConnectionList app={app} />
		</div>
	)
}

interface ConnectionListProps {
	app: Canvas
}

const ConnectionList: React.FC<ConnectionListProps> = ({ app }) => {
	const [peers, setPeers] = useState<string[]>([])

	useEffect(() => {
		if (app === null) {
			return
		}

		const handleConnectionOpen = ({ detail: { peer } }: CustomEvent<{ peer: string }>) =>
			void setPeers((peers) => [...peers, peer])

		const handleConnectionClose = ({ detail: { peer } }: CustomEvent<{ peer: string }>) =>
			void setPeers((peers) => peers.filter((id) => id !== peer))

		app.messageLog.addEventListener("connect", handleConnectionOpen)
		app.messageLog.addEventListener("disconnect", handleConnectionClose)

		return () => {
			app.messageLog.removeEventListener("connect", handleConnectionOpen)
			app.messageLog.removeEventListener("disconnect", handleConnectionClose)
		}
	}, [app])

	if (peers.length === 0) {
		return <div className="italic">No connections</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{peers.map((peer) => {
					return (
						<li key={peer}>
							<code className="text-sm">{peer}</code>
						</li>
					)
				})}
			</ul>
		)
	}
}
