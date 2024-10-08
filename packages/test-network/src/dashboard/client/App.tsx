import React, { useCallback, useEffect, useMemo, useState } from "react"

import type { Event } from "../../types.js"
import { Graph } from "./Graph.js"
// import { EventLog } from "./EventLog.js"

type State = {
	mesh: Record<string, string[]>
	nodes: { id: string; topic: string | null }[]
	links: { id: string; source: string; target: string }[]
	roots: Record<string, string | null>
}

const bootstrapPeerIds = ["12D3KooWMvSCSeJ6zxJJRQZSpyGqbNcqSJfcJGZLRiMVMePXzMax"]

function reduce(state: State, event: Event): State {
	// console.log(event)
	if (event.type === "start") {
		if (state.nodes.every((node) => node.id !== event.peerId)) {
			return {
				...state,
				nodes: [...state.nodes, { id: event.peerId, topic: event.detail.topic }],
				roots: { ...state.roots, [event.peerId]: event.detail.root ?? null },
			}
		}
	} else if (event.type === "connection:open") {
		if (state.links.every((link) => link.id !== event.detail.id)) {
			return {
				...state,
				links: [...state.links, { id: event.detail.id, source: event.peerId, target: event.detail.remotePeer }],
			}
		}
	} else if (event.type === "connection:close") {
		return { ...state, links: state.links.filter((link) => link.id !== event.detail.id) }
	} else if (event.type === "gossipsub:mesh:update") {
		return { ...state, mesh: { ...state.mesh, [event.peerId]: event.detail.peers } }
	} else if (event.type === "gossiplog:commit") {
		return {
			...state,
			roots: { ...state.roots, [event.peerId]: event.detail.root },
		}
	}

	return state
}

export const App: React.FC<{}> = ({}) => {
	const [state, setState] = useState<State>({ nodes: [], links: [], roots: {}, mesh: {} })

	useEffect(() => {
		const eventSource = new EventSource("/api/events")
		eventSource.addEventListener("error", (event) => console.error("error in event source", event))
		eventSource.addEventListener("close", (event) => console.log("closed event source", event))
		eventSource.addEventListener("message", ({ data }) => {
			const event = JSON.parse(data) as Event
			setState((state) => reduce(state, event))
		})

		return () => eventSource.close()
	}, [])

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

	return (
		<section>
			<Graph
				{...state}
				bootstrapPeerIds={bootstrapPeerIds}
				onNodeClick={handleNodeClick}
				onLinkClick={handleLinkClick}
			/>
			<hr />
		</section>
	)
}
