import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Graph } from "./Graph.js"

type Event =
	| { type: "start"; id: string; t: number; detail: {} }
	| { type: "connection:open"; id: string; t: number; detail: { id: string; remotePeer: string; remoteAddr: string } }
	| { type: "connection:close"; id: string; t: number; detail: { id: string; remotePeer: string; remoteAddr: string } }
	| { type: "gossipsub:mesh:update"; id: string; t: number; detail: { topic: string; peers: string[] } }

type State = {
	mesh: Map<string, string[]>
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
			mesh.set(event.id, event.detail.peers)
		}
	}

	return { mesh, nodes, links }
}

export const App: React.FC<{}> = ({}) => {
	const mesh = useMemo(() => new Map<string, string[]>(), [])
	const events = useMemo<Array<Event | null>>(() => [], [])
	const [digest, setDigest] = useState(0n)

	const [nodes, setNodes] = useState<{ id: string }[]>([])
	const nodesRef = useRef(nodes)

	const [links, setLinks] = useState<{ id: string; source: string; target: string }[]>([])
	const linksRef = useRef(links)

	useEffect(() => {
		const eventSource = new EventSource("/events")
		eventSource.addEventListener("error", (event) => console.error("error in event source", event))
		eventSource.addEventListener("close", (event) => console.log("closed event source", event))
		eventSource.addEventListener("message", ({ data }) => {
			const { index, ...event } = JSON.parse(data) as Event & { index: number }

			if (index < events.length) {
				events[index] = event
			} else if (index === events.length) {
				events.push(event)
			} else {
				const start = events.length
				events.length = index + 1
				events.fill(null, start)
				events[index] = event
			}

			const digest = events.reduce((prev, curr, i) => {
				const bit = curr === null ? 0n : 1n
				return prev | (bit << BigInt(i))
			}, 0n)

			setDigest(digest)

			const { nodes, links } = reduce({ mesh, nodes: nodesRef.current, links: linksRef.current }, event)
			setNodes((nodesRef.current = nodes))
			setLinks((linksRef.current = links))
		})

		return () => eventSource.close()
	}, [])

	const [min, max] = useMemo(() => {
		let [min, max] = [Infinity, 0]

		for (const event of events) {
			if (event === null) continue
			if (event.t < min) min = event.t
			if (event.t > max) max = event.t
		}

		return [min, max]
	}, [digest])

	// const [range, setRange] = useState<null | number>(null)
	// const handleRangeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
	// 	const rangeValue = parseInt(event.target.value)
	// 	const range = rangeValue === 100 ? null : rangeValue
	// }, [])

	// const rangeValue = range === null ? 100 :

	return (
		<>
			<section>
				<Graph mesh={mesh} nodes={nodes} links={links} bootstrapPeerIds={bootstrapPeerIds} />
				{/* 
				<input
					style={{ width: "100%" }}
					type="range"
					min={0}
					max={100}
					value={rangeValue}
					onChange={handleRangeChange}
				/> */}
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
