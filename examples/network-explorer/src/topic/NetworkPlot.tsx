import { Action, Session } from "@canvas-js/interfaces"
import { fetchAndIpldParseJson, formatDid, Result } from "../utils.js"
import useSWR from "swr"
import * as d3 from "d3"
import { PropsWithChildren, useLayoutEffect, useRef, useState } from "react"

function DivWithRectUpdate(
	props: PropsWithChildren & {
		onRectUpdate: (rect: DOMRect) => void
		style?: React.CSSProperties
	},
) {
	const ref = useRef<HTMLDivElement>(null)
	const currentRect = useRef<DOMRect | null>(null)

	useLayoutEffect(() => {
		if (ref.current) {
			const newRect = ref.current.getBoundingClientRect()

			const oldRect = currentRect.current
			currentRect.current = newRect

			if (
				// only call the callback if the rect is being set for the first time
				// or if the y or height values have changed
				// should use a deeper comparison here
				oldRect == null ||
				oldRect.y !== newRect.y ||
				oldRect.height !== newRect.height
			) {
				props.onRectUpdate(newRect)
			}
		}
	})

	return (
		<div ref={ref} style={props.style}>
			{props.children}
		</div>
	)
}

function MessageEntry({ item }: { item: Result<Action | Session> }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "row",
				border: "solid lightgray 1px",
				borderRadius: "8px",
				padding: "5px",
			}}
		>
			<span
				style={
					{
						/*color: "darkgray", fontStyle: "italic" */
					}
				}
			>
				{item.message.payload.type}
			</span>
			<div style={{ flexGrow: 1 }}></div>
			<span></span>
			<span
				style={
					{
						/*color: "darkgray", fontStyle: "italic"*/
					}
				}
			>
				address: {formatDid(item.message.payload.did)}, clock: {item.message.clock}, branch: {item.branch}
			</span>
		</div>
	)
	{
		/* <div>
	<div style={{ display: "flex", flexDirection: "row" }}>
		<span>Timestamp: {new Date(item.message.payload.context.timestamp).toLocaleString()} </span>
		<div style={{ flexGrow: 1 }}></div>
		<span>Address: {formatDid(item.message.payload.did)}</span>
	</div>
	{item.message.payload.type == "session" ? (
		<>Public key: {item.message.payload.publicKey}</>
	) : (
		<>
			Name: {item.message.payload.name} <br />
			Args: {JSON.stringify(item.message.payload.args)}
		</>
	)}
</div> */
	}
}

export default function NetworkPlot({ topic }: { topic: string }) {
	const { data: messages } = useSWR(
		`/index_api/messages/${topic}?limit=all`,
		fetchAndIpldParseJson<Result<Action | Session>[]>,
		{
			refreshInterval: 1000,
		},
	)

	const [divHeight, setDivHeight] = useState(0)
	const [divTop, setDivTop] = useState(0)
	const [itemYOffsets, setItemYOffsets] = useState<Record<string, number>>({})

	const color = d3.scaleOrdinal(d3.schemeDark2)

	const items = (messages || []).slice()
	items.reverse()

	const links: [from: string, to: string][] = []

	for (const item of items) {
		for (const parentId of item.message.parents) {
			links.push([item.id, parentId])
		}
	}

	const nodes: { id: string; branch: number; x: number; y: number }[] = items.map((item) => ({
		id: item.id,
		branch: item.branch,
		x: 20 + item.branch * 20,
		// the +2 here is a bit magic, it's just that if we take the
		// exact centre of the div then the dot will be slightly high
		y: itemYOffsets[item.id] + 2 - divTop || 0,
	}))
	const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]))

	const graphWidth = 140

	return (
		<>
			<div style={{ display: "flex", flexDirection: "row", paddingBottom: "10px" }}>
				<div>
					<svg width={graphWidth} height={divHeight}>
						{links.map(([from, to], index) => {
							let f = nodesById[from]
							let t = nodesById[to]
							const c = 5
							const r = 10

							if (f.y > t.y) {
								const temp = f
								f = t
								t = temp
							}

							let path: string
							if (f.x == t.x) {
								path = `
            M${f.x} ${f.y}
            L${t.x} ${t.y}
            `
							} else if (t.x > f.x) {
								path = `
								M${f.x} ${f.y}
								L${f.x} ${t.y - c - r - r}
								A ${r} ${r} 90 0 0 ${f.x + r} ${t.y - c - r}
								L${t.x - r} ${t.y - c - r}
								A ${r} ${r} 90 0 1 ${t.x} ${t.y - c}
            		L${t.x} ${t.y}
            `
							} else {
								path = `
								M${f.x} ${f.y}
								L${f.x} ${t.y - c - r - r}
								A ${r} ${r} 90 0 1 ${f.x - r} ${t.y - c - r}
								L${t.x + r} ${t.y - c - r}
								A ${r} ${r} 90 0 0 ${t.x} ${t.y - c}
								L${t.x} ${t.y}
            `
								// throw new Error("unreachable")
							}

							return (
								<path
									key={`link-${index}`}
									className="link"
									d={path}
									fill="none"
									stroke={color(t.branch.toString())}
									strokeWidth="2"
								/>
							)
						})}
						{nodes.map(({ x, y, branch }, index) => {
							return (
								<>
									<path
										key={`node-trace-${index}-shadow`}
										stroke="white"
										strokeWidth="2px"
										d={`M${x} ${y} L${graphWidth} ${y}`}
									/>
									<path
										key={`node-trace-${index}`}
										stroke="black"
										strokeWidth="1px"
										d={`M${x} ${y} L${graphWidth} ${y}`}
									/>
									<path
										key={`node-${index}`}
										className="selectable node"
										data-id={index}
										stroke="black"
										strokeLinecap="round"
										strokeWidth="16"
										d={`M${x} ${y} L${x} ${y}`}
									/>
									<path
										key={`node-border-${index}`}
										className="node"
										stroke="white"
										strokeLinecap="round"
										strokeWidth="10"
										d={`M${x} ${y} L${x} ${y}`}
									/>
								</>
							)
						})}
					</svg>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						flexGrow: "1",
					}}
				>
					<DivWithRectUpdate
						onRectUpdate={(rect) => {
							setDivHeight(rect.height)
							setDivTop(window.scrollY + rect.top)
						}}
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "5px",
							flexGrow: "0",
							paddingTop: "20px",
							width: "100%",
						}}
					>
						{items.map((item, index) => (
							<DivWithRectUpdate
								key={index}
								onRectUpdate={(rect) => {
									setItemYOffsets((prev) => ({
										...prev,
										[item.id]: window.scrollY + rect.top + rect.height / 2,
									}))
								}}
							>
								<MessageEntry item={item} />
							</DivWithRectUpdate>
						))}
					</DivWithRectUpdate>
				</div>
			</div>
		</>
	)
}
