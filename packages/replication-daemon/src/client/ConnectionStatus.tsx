import React, { useContext } from "react"

import { AppContext } from "./AppContext.js"

export interface ConnectionStatusProps {}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({}) => {
	const { state } = useContext(AppContext)

	if (state === null) {
		return null
	}

	return (
		<div className="p-2 border rounded flex flex-col gap-2 bg-white">
			<div>
				<span className="text-sm">Peer Id</span>
			</div>
			<div>
				<code className="text-sm">{state.peerId}</code>
			</div>
			<hr />
			<div>
				<span className="text-sm">Connections</span>
			</div>
			<ConnectionList />
		</div>
	)
}

interface ConnectionListProps {}

const ConnectionList: React.FC<ConnectionListProps> = ({}) => {
	const { state } = useContext(AppContext)

	if (state === null) {
		return null
	}

	if (state.connections.length === 0) {
		return <div className="italic">No connections</div>
	} else {
		return (
			<ul className="list-disc pl-4">
				{state.connections.map((connection) => {
					return (
						<li key={connection.id}>
							<div>
								<code className="text-sm">{connection.remotePeer}</code>
							</div>
							<div>
								<code className="text-sm break-all text-gray-500">{connection.remoteAddr}</code>
							</div>
						</li>
					)
				})}
			</ul>
		)
	}
}
