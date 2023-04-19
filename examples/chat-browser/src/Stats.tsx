import React, { useCallback, useEffect, useRef, useState } from "react"

import { nanoid } from "nanoid"
import { useCanvas } from "@canvas-js/hooks"
import { SyncEventDetail } from "@canvas-js/interfaces"

const second = 1000
const minute = 60 * second
const syncLogCapacity = 20

export const Stats: React.FC<{}> = ({}) => {
	const { data, api } = useCanvas()

	const [syncLog, setSyncLog] = useState<[string, SyncEventDetail][]>([])
	const syncLogRef = useRef(syncLog)

	const pushSyncEvent = useCallback((event: CustomEvent<SyncEventDetail>) => {
		const newSyncLog: [string, SyncEventDetail][] = [
			[nanoid(8), event.detail],
			...syncLogRef.current.slice(0, syncLogCapacity - 1),
		]

		syncLogRef.current = newSyncLog
		setSyncLog(newSyncLog)
	}, [])

	useEffect(() => {
		if (api !== null) {
			api.addEventListener("sync", pushSyncEvent)
			return () => api.removeEventListener("sync", pushSyncEvent)
		}
	}, [api])

	const now = Date.now()
	const merkleRoot = data && (data.merkleRoots[data.uri] ?? null)

	if (data === null) {
		return null
	}

	return (
		<div className="window" style={{ width: 420 }}>
			<div className="title-bar">
				<div className="title-bar-text">Stats</div>
			</div>
			<div className="window-body">
				{merkleRoot && <p>Merkle root: {merkleRoot}</p>}
				<p>Active connections:</p>
				<ul className="tree-view" style={{ maxHeight: 100, overflowY: "auto" }}>
					{data.peers.length > 0 ? (
						data.peers.map(({ id, addresses }) => (
							<li key={id}>
								<details open={false}>
									<summary>{id}</summary>
									{addresses && addresses.length > 0 && (
										<ul>
											{addresses.map((address) => (
												<li key={address}>{address}</li>
											))}
										</ul>
									)}
								</details>
							</li>
						))
					) : (
						<div style={{ color: "grey" }}>
							<em>No peer connections</em>
						</div>
					)}
				</ul>
				<p>MST sync history:</p>
				<ul className="tree-view" style={{ maxHeight: 100, overflowY: "auto" }}>
					{syncLog.length === 0 ? (
						<div style={{ color: "grey" }}>
							<em>Sync events appear as they happen</em>
						</div>
					) : (
						syncLog.map(([key, { peer, time, status }]) => (
							<li key={key}>
								<div>{peer}</div>
								<div style={{ color: "grey" }}>
									{Math.round((now - time) / minute)}min ago ({status})
								</div>
								<hr />
							</li>
						))
					)}
				</ul>
			</div>
		</div>
	)
}
