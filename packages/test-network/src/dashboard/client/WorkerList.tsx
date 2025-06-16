import React, { useMemo } from "react"

export interface WorkerListProps {
	workers: { id: string }[]
	nodes: { id: string; topic: string | null; workerId: string | null }[]

	startPeer: (workerId: string) => void
	stopPeer: (workerId: string, peerId: string) => void
}

export const WorkerList: React.FC<WorkerListProps> = (props) => {
	return (
		<div>
			<h2>Workers</h2>
			{props.workers.length === 0 ? (
				<div>
					<em>no workers</em>
				</div>
			) : (
				<div className="worker-list">
					{props.workers.map((worker) => (
						<Worker workerId={worker.id} nodes={props.nodes} startPeer={props.startPeer} stopPeer={props.stopPeer} />
					))}
				</div>
			)}
		</div>
	)
}

interface WorkerProps {
	workerId: string
	nodes: { id: string; topic: string | null; workerId: string | null }[]

	startPeer: (workerId: string) => void
	stopPeer: (workerId: string, peerId: string) => void
}

const Worker: React.FC<WorkerProps> = (props) => {
	const peers = useMemo(
		() => props.nodes.filter((node) => node.workerId === props.workerId),
		[props.workerId, props.nodes],
	)

	return (
		<div className="worker">
			<div className="worker-header" style={{ display: "flex", gap: "1em" }}>
				<code>{props.workerId}</code>
				<button onClick={() => props.startPeer(props.workerId)}>add peer</button>
			</div>
			<div>
				{peers.length === 0 ? (
					<em>no peers</em>
				) : (
					<ul>
						{peers.map((peer) => (
							<li key={peer.id}>
								<span className="worker-peer">
									<code>{peer.id.slice(-6)}</code>
									<button onClick={() => props.stopPeer(props.workerId, peer.id)}>stop</button>
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}
