import React, { useMemo, useState } from "react"

export interface WorkerListProps {
	workers: { id: string; autospawn: { total: number; lifetime: number; publishInterval: number } | null }[]
	nodes: { id: string; topic: string | null; workerId: string | null }[]

	startPeer: (workerId: string) => void
	stopPeer: (workerId: string, peerId: string) => void
	startPeerAuto: (
		workerId: string,
		options: {
			total: number
			lifetime: number
			publishInterval: number
		},
	) => void
	stopPeerAuto: (workerId: string) => void
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
						<Worker
							workerId={worker.id}
							autospawn={worker.autospawn}
							nodes={props.nodes}
							startPeer={props.startPeer}
							stopPeer={props.stopPeer}
							startPeerAuto={props.startPeerAuto}
							stopPeerAuto={props.stopPeerAuto}
						/>
					))}
				</div>
			)}
		</div>
	)
}

interface WorkerProps {
	workerId: string
	autospawn: { total: number; lifetime: number; publishInterval: number } | null
	nodes: { id: string; topic: string | null; workerId: string | null }[]

	startPeer: (workerId: string) => void
	stopPeer: (workerId: string, peerId: string) => void
	startPeerAuto: (
		workerId: string,
		options: {
			total: number
			lifetime: number
			publishInterval: number
		},
	) => void
	stopPeerAuto: (workerId: string) => void
}

const Worker: React.FC<WorkerProps> = (props) => {
	const peers = useMemo(
		() => props.nodes.filter((node) => node.workerId === props.workerId),
		[props.workerId, props.nodes],
	)

	const [total, setTotal] = useState(10)
	const [lifetime, setLifetime] = useState(40)
	const [publishInterval, setPublishInterval] = useState(10)

	return (
		<div className="worker">
			<div className="worker-header">
				<code>w-{props.workerId}</code>
				<button onClick={() => props.startPeer(props.workerId)}>add peer</button>
			</div>
			<div className="worker-autospawn">
				<label>
					total peer count:
					<input
						type="number"
						disabled={props.autospawn !== null}
						value={total}
						onChange={(event) => setTotal(parseInt(event.target.value))}
					/>
				</label>

				<label>
					lifetime (s):
					<input
						type="number"
						disabled={props.autospawn !== null}
						value={lifetime}
						onChange={(event) => setLifetime(parseInt(event.target.value))}
					/>
				</label>

				<label>
					publish interval (s):
					<input
						type="number"
						disabled={props.autospawn !== null}
						value={publishInterval}
						onChange={(event) => setPublishInterval(parseInt(event.target.value))}
					/>
				</label>

				{props.autospawn === null ? (
					<button onClick={() => props.startPeerAuto(props.workerId, { total, lifetime, publishInterval })}>
						start auto-spawn
					</button>
				) : (
					<button onClick={() => props.stopPeerAuto(props.workerId)}>stop auto-spawn</button>
				)}
			</div>
			<div>
				{peers.length === 0 ? (
					<em>no peers</em>
				) : (
					<ul>
						{peers.map((peer) => (
							<li key={peer.id}>
								<span className="worker-peer">
									<code>p-{peer.id.slice(-6)}</code>
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
