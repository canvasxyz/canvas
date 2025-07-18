import React, { useMemo, useState } from "react"

export interface WorkerListProps {
	workers: { id: string; autospawn: { total: number; lifetime: number; publishInterval: number } | null }[]
	nodes: { id: string; topic: string | null; workerId: string | null }[]
	roots: Record<string, { clock: number | null; heads: string[] | null; root: string | null }>

	startPeer: (workerId: string) => void
	stopPeer: (workerId: string, peerId: string) => void
	startPeerAuto: (
		workerId: string,
		options: {
			total: number
			lifetime: number
			publishInterval: number
			spawnInterval: number
		},
	) => void
	stopPeerAuto: (workerId: string) => void
}

export const WorkerList: React.FC<WorkerListProps> = (props) => {
	return (
		<div className="worker-list-container">
			<div className="worker-list-header">
				<h2>Workers</h2>

				<a href="/client-libp2p" target="_blank">
					open browser peer
				</a>
			</div>

			{props.workers.length === 0 ? (
				<div className="worker-list">
					<em>no workers</em>
				</div>
			) : (
				<div className="worker-list">
					{props.workers.map((worker) => (
						<Worker
							workerId={worker.id}
							autospawn={worker.autospawn}
							nodes={props.nodes}
							roots={props.roots}
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
	roots: Record<string, { clock: number | null; heads: string[] | null; root: string | null }>
	startPeer: (workerId: string) => void
	stopPeer: (workerId: string, peerId: string) => void
	startPeerAuto: (
		workerId: string,
		options: {
			total: number
			lifetime: number
			publishInterval: number
			spawnInterval: number
		},
	) => void
	stopPeerAuto: (workerId: string) => void
}

const Worker: React.FC<WorkerProps> = (props) => {
	const peers = useMemo(
		() => props.nodes.filter((node) => node.workerId === props.workerId),
		[props.workerId, props.nodes],
	)

	const [total, setTotal] = useState(5)
	const [lifetime, setLifetime] = useState(60)
	const [publishInterval, setPublishInterval] = useState(1)
	const [spawnInterval, setSpawnInterval] = useState(1)

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
				<label>
					spawn interval (s):
					<input
						type="number"
						disabled={props.autospawn !== null}
						value={spawnInterval}
						onChange={(event) => setSpawnInterval(parseInt(event.target.value))}
					/>
				</label>

				{props.autospawn === null ? (
					<button
						onClick={() => props.startPeerAuto(props.workerId, { total, lifetime, publishInterval, spawnInterval })}
					>
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
					<ul className="worker-peer-list">
						{peers.map((peer) => {
							const { clock, heads } = props.roots[peer.id]
							return (
								<li key={peer.id}>
									<span className="worker-peer">
										<code>
											p-{peer.id.slice(-6)} ({clock ?? 0} {"*".repeat(heads?.length ?? 0)})
										</code>
										<button onClick={() => props.stopPeer(props.workerId, peer.id)}>stop</button>
									</span>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</div>
	)
}
