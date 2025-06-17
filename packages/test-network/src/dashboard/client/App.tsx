import React, { useCallback, useEffect, useState } from "react"

import { NetworkEvent, NetworkState, initialState, reduce } from "@canvas-js/test-network/events"
import { Graph } from "./Graph.js"
import { WorkerList } from "./WorkerList.js"

const bootstrapPeerIds = ["12D3KooWMvSCSeJ6zxJJRQZSpyGqbNcqSJfcJGZLRiMVMePXzMax"]

export const App: React.FC<{}> = ({}) => {
	const [state, setState] = useState<NetworkState>(initialState)
	const [hasAutoStarted, setHasAutoStarted] = useState(false)

	useEffect(() => {
		const eventSource = new EventSource("/api/events")
		eventSource.addEventListener("error", (event) => console.error("error in event source", event))
		eventSource.addEventListener("close", (event) => console.log("closed event source", event))
		eventSource.addEventListener("message", ({ data }) => {
			const event = JSON.parse(data) as NetworkEvent
			setState((state) => reduce(state, event))
		})

		return () => eventSource.close()
	}, [])

	// Auto-start autospawn for all workers once when page loads.
	// Each autospawn replaces the last, and in the worst case, this
	// may cause an extra peer to be created if spawn() was called
	// but the peer has not yet come online.
	useEffect(() => {
		if (!hasAutoStarted && state.workers.length > 0) {
			state.workers.forEach((worker) => {
				startPeerAuto(worker.id, {
					total: 3,
					lifetime: 0,
					publishInterval: 1,
					spawnInterval: 1,
				})
			})
			setHasAutoStarted(true)
		}
	}, [state.workers, hasAutoStarted])

	const handleNodeClick = useCallback((id: string, shiftKey: boolean, metaKey: boolean) => {
		if (shiftKey && metaKey) {
			//
		} else if (metaKey) {
			console.log("provide", id)
			fetch(`/api/provide/${id}`, { method: "POST" }).then((res) => {
				if (!res.ok) {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		} else if (shiftKey) {
			console.log("query", id)
			fetch(`/api/query/${id}`, { method: "POST" }).then((res) => {
				if (!res.ok) {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		} else {
			console.log("append", id)
			fetch(`/api/append/${id}`, { method: "POST" }).then((res) => {
				if (!res.ok) {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		}
	}, [])

	const handleLinkClick = useCallback((source: string, target: string) => {
		console.log("LinkClick", source, target)

		fetch(`/api/disconnect/${source}/${target}`, { method: "POST" }).then((res) => {
			if (!res.ok) {
				res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
			}
		})
	}, [])

	const startPeer = useCallback((workerId: string) => {
		fetch(`/api/worker/${workerId}/start`, { method: "POST" }).then((res) => {
			if (!res.ok) {
				res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
			}
		})
	}, [])

	const stopPeer = useCallback((workerId: string, peerId: string) => {
		fetch(`/api/worker/${workerId}/stop?peerId=${peerId}`, { method: "POST" }).then((res) => {
			if (!res.ok) {
				res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
			}
		})
	}, [])

	const startPeerAuto = useCallback(
		(
			workerId: string,
			options: { total: number; lifetime: number; publishInterval: number; spawnInterval: number },
		) => {
			const query = Object.entries(options)
				.map(([name, value]) => `${name}=${value}`)
				.join("&")

			fetch(`/api/worker/${workerId}/start/auto?${query}`, {
				method: "POST",
			}).then((res) => {
				if (!res.ok) {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		},
		[],
	)

	const stopPeerAuto = useCallback((workerId: string) => {
		fetch(`/api/worker/${workerId}/stop/auto`, { method: "POST" }).then((res) => {
			if (!res.ok) {
				res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
			}
		})
	}, [])

	return (
		<>
			<Graph
				{...state}
				bootstrapPeerIds={bootstrapPeerIds}
				onNodeClick={handleNodeClick}
				onLinkClick={handleLinkClick}
			/>
			<div>
				<WorkerList
					workers={state.workers}
					nodes={state.nodes}
					clocks={state.clocks}
					heads={state.heads}
					startPeer={startPeer}
					stopPeer={stopPeer}
					startPeerAuto={startPeerAuto}
					stopPeerAuto={stopPeerAuto}
				/>
			</div>
		</>
	)
}
