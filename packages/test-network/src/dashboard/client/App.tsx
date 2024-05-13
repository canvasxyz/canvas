import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { Event } from "../shared/types.js"
import { Graph, width } from "./Graph.js"
import { EventLog } from "./EventLog.js"

type State = {
	mesh: Record<string, string[]>
	nodes: { id: string }[]
	links: { id: string; source: string; target: string }[]
	roots: Record<string, string>
}

const topic = "test-network-example"
const bootstrapPeerIds = ["12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn"]

function reduce(state: State, event: Event): State {
	if (event.type === "start") {
		if (state.nodes.every((node) => node.id !== event.id)) {
			return {
				...state,
				nodes: [...state.nodes, { id: event.id }],
				roots: { ...state.roots, [event.id]: event.detail.root },
			}
		}
	} else if (event.type === "connection:open") {
		if (state.links.every((link) => link.id !== event.detail.id)) {
			return {
				...state,
				links: [...state.links, { id: event.detail.id, source: event.id, target: event.detail.remotePeer }],
			}
		}
	} else if (event.type === "connection:close") {
		return { ...state, links: state.links.filter((link) => link.id !== event.detail.id) }
	} else if (event.type === "gossipsub:mesh:update") {
		if (event.detail.topic === topic) {
			return { ...state, mesh: { ...state.mesh, [event.id]: event.detail.peers } }
		}
	} else if (event.type === "gossiplog:commit") {
		if (event.detail.topic === topic) {
			return {
				...state,
				roots: { ...state.roots, [event.id]: event.detail.root },
			}
		}
	}

	return state
}

export const App: React.FC<{}> = ({}) => {
	// const [events, setEvents] = useState<Event[]>([])
	const [state, setState] = useState<State>({ nodes: [], links: [], roots: {}, mesh: {} })
	// const [messages, setMessages] = useState<{ peerId: string; data: string }[]>([])

	// const events = useMemo<Array<Event | null>>(() => [], [])
	// const [eventCount, setEventCount] = useState(0)

	useEffect(() => {
		const eventSource = new EventSource("/api/events")
		eventSource.addEventListener("error", (event) => console.error("error in event source", event))
		eventSource.addEventListener("close", (event) => console.log("closed event source", event))
		eventSource.addEventListener("message", ({ data }) => {
			const event = JSON.parse(data) as Event
			// setEvents((events) => [...events, event])
			setState((state) => reduce(state, event))
		})

		return () => eventSource.close()
	}, [])

	// const [min, max] = useMemo(() => {
	// 	let [min, max] = [Infinity, 0]

	// 	for (const event of events) {
	// 		if (event === null) continue
	// 		if (event.t < min) min = event.t
	// 		if (event.t > max) max = event.t
	// 	}

	// 	return [min, max]
	// }, [eventCount])

	// const [maxIndex, setMaxIndex] = useState<null | number>(null)
	// const handleRangeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
	// 	const rangeValue = parseInt(event.target.value)
	// 	if (rangeValue === 100) {
	// 		setMaxIndex(null)
	// 	} else {
	// 		setMaxIndex(Math.round(events.length * (rangeValue / 100)))
	// 	}
	// }, [])

	// const rangeValue = events.length === 0 ? 100 : Math.round(100 * ((maxIndex ?? events.length) / events.length))

	const handleNodeClick = useCallback((id: string, shiftKey: boolean, metaKey: boolean) => {
		if (shiftKey && metaKey) {
			//
		} else if (metaKey) {
			console.log("provide", id)
			fetch(`/api/provide/${id}`, { method: "POST" }).then((res) => {
				if (res.ok) {
					res.json().then((results) => console.log("provide results", results))
				} else {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		} else if (shiftKey) {
			console.log("query", id)
			fetch(`/api/query/${id}`, { method: "POST" }).then((res) => {
				if (res.ok) {
					res.json().then((results) => console.log("query results", results))
				} else {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		} else {
			console.log("boop", id)
			fetch(`/api/boop/${id}`, { method: "POST" }).then((res) => {
				if (res.ok) {
					res.json().then((recipients) => console.log("recipients", recipients))
				} else {
					res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
				}
			})
		}
	}, [])

	const handleLinkClick = useCallback((source: string, target: string) => {
		console.log("LinkClick", source, target)

		fetch(`/api/disconnect/${source}/${target}`, { method: "POST" }).then((res) => {
			if (res.ok) {
				console.log("disconnected")
			} else {
				res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
			}
		})
	}, [])

	const [eventLogVisible, setEventLogVisible] = useState(false)

	return (
		<>
			<section>
				<Graph
					{...state}
					// messages={messages}
					bootstrapPeerIds={bootstrapPeerIds}
					onNodeClick={handleNodeClick}
					onLinkClick={handleLinkClick}
				/>
			</section>

			<hr />

			{/* <EventLog events={events} /> */}
		</>
	)
}
