import React, { useCallback, useEffect, useState } from "react"

import { Event, State, reduce } from "../../events.js"
import { Graph } from "./Graph.js"

// import { EventLog } from "./EventLog.js"

const bootstrapPeerIds = ["12D3KooWMvSCSeJ6zxJJRQZSpyGqbNcqSJfcJGZLRiMVMePXzMax"]

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
