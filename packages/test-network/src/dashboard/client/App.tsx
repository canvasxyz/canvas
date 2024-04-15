import React, { useCallback, useEffect, useMemo, useState } from "react"
import type { Event } from "../shared/types.js"
import { Graph, width } from "./Graph.js"

type State = {
	mesh: Record<string, string[]>
	nodes: { id: string }[]
	links: { id: string; source: string; target: string }[]
}

const topic = "test-network-example"
const bootstrapPeerIds = ["12D3KooWNbCWxWV3Tmu38pEi2hHVUiBHbr7x6bHLFQXRqgui6Vrn"]

function reduce({ mesh, nodes, links }: State, event: Event): State {
	if (event.type === "start") {
		if (nodes.every((node) => node.id !== event.id)) {
			return { mesh, nodes: [...nodes, { id: event.id }], links }
		}
	} else if (event.type === "connection:open") {
		if (links.every((link) => link.id !== event.detail.id)) {
			return {
				mesh,
				nodes,
				links: [...links, { id: event.detail.id, source: event.id, target: event.detail.remotePeer }],
			}
		}
	} else if (event.type === "connection:close") {
		return { mesh, nodes, links: links.filter((link) => link.id !== event.detail.id) }
	} else if (event.type === "gossipsub:mesh:update") {
		if (event.detail.topic === topic) {
			return { mesh: { ...mesh, [event.id]: event.detail.peers }, nodes, links }
		}
	}

	return { mesh, nodes, links }
}

export const App: React.FC<{}> = ({}) => {
	const [state, setState] = useState<State>({ mesh: {}, nodes: [], links: [] })
	const [messages, setMessages] = useState<{ peerId: string; data: string }[]>([])

	const events = useMemo<Array<Event | null>>(() => [], [])
	const [eventCount, setEventCount] = useState(0)

	useEffect(() => {
		const eventSource = new EventSource("/api/events")
		eventSource.addEventListener("error", (event) => console.error("error in event source", event))
		eventSource.addEventListener("close", (event) => console.log("closed event source", event))
		eventSource.addEventListener("message", ({ data }) => {
			const event = JSON.parse(data) as Event
			if (event.type === "gossipsub:message") {
				const message = { peerId: event.id, data: event.detail.data }
				setMessages((messages) => [...messages, message])
				setTimeout(() => setMessages((messages) => messages.filter((m) => m !== message)), 2000)
			} else {
				setEventCount(events.push(event))
				setState((prev) => reduce(prev, event))
			}
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

	const handleClick = useCallback((id: string) => {
		fetch(`/api/boop/${id}`, { method: "POST" }).then((res) => {
			if (res.ok) {
				res.json().then((recipients) => console.log("recipients", recipients))
			} else {
				res.text().then((err) => console.error(`[${res.status} ${res.statusText}]`, err))
			}
		})
	}, [])

	return (
		<>
			<section>
				<Graph {...state} messages={messages} bootstrapPeerIds={bootstrapPeerIds} onClick={handleClick} />
				{/* <input style={{ width }} type="range" min={0} max={100} value={rangeValue} onChange={handleRangeChange} /> */}
			</section>

			<hr />

			<pre>
				{events.map((event, index) => {
					if (event === null) {
						return null
					}

					const { type, id, t, detail } = event
					const time = new Date(t).toISOString().slice(11, -1)
					return (
						<div key={index}>
							<code>
								[{time}] [{id}] {type} {JSON.stringify(detail, null, "  ")}
							</code>
						</div>
					)
				})}
			</pre>
		</>
	)
}
