import React, { useMemo, useState } from "react"

export interface WorkerListProps {
	workers: { id: string }[]
	nodes: { id: string; topic: string | null; workerId: string | null }[]

	startPeer: (workerId: string, times: number, interval: number) => void
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

	startPeer: (workerId: string, times: number, interval: number) => void
	stopPeer: (workerId: string, peerId: string) => void
}

const Worker: React.FC<WorkerProps> = (props) => {
	const peers = useMemo(
		() => props.nodes.filter((node) => node.workerId === props.workerId),
		[props.workerId, props.nodes],
	)
	const [interval, setInterval] = useState(10)

	return (
		<div className="worker">
			<div style={{ marginBottom: "0.5em" }}>
				<code>{props.workerId}</code>
			</div>
			<div style={{ marginBottom: "0.5em" }}>
				<label>
					Generate messages with interval:
					<input
						type="number"
						min={1}
						value={interval}
						onChange={e => setInterval(Number(e.target.value))}
						style={{ width: 60, marginLeft: 8 }}
					/>
				</label>
			</div>
			<div className="worker-header" style={{ display: "flex", gap: "1em" }}>
				<button onClick={() => props.startPeer(props.workerId, 1, interval)}>add peer</button>
				<button onClick={() => props.startPeer(props.workerId, 5, interval)}>add x5</button>
				<button onClick={() => props.startPeer(props.workerId, 10, interval)}>add x10</button>
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
