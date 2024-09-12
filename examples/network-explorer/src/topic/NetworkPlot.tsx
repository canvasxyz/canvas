import { Action, Session } from "@canvas-js/interfaces"
import { fetchAndIpldParseJson, formatDid, Result } from "../utils.js"
import useSWR from "swr"
import * as d3 from "d3"
import { PropsWithChildren, useLayoutEffect, useRef, useState } from "react"
import { Box, Card, Flex } from "@radix-ui/themes"
import { DidTooltip } from "../components/DidTooltip.js"

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
		<Card>
			<Flex direction="row">
				{item.message.payload.type}
				<Box flexGrow="1" />
				address:&nbsp;
				<DidTooltip did={item.message.payload.did} />, clock: {item.message.clock}, branch: {item.branch}
			</Flex>
		</Card>
	)
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
	items.sort((a, b) => {
		if (a.message.clock == b.message.clock) {
			return a.branch - b.branch
		} else {
			return a.message.clock - b.message.clock
		}
	})

	const links: [from: string, to: string][] = []

	for (const item of items) {
		for (const parentId of item.message.parents) {
			links.push([parentId, item.id])
		}
	}

	const nodeRadius = 8
	const nodeBorderRadius = 4

	const lineStrokeWidth = 2

	const branches: Record<number, { start: string; end: string }> = {}
	for (const item of items) {
		branches[item.branch] ||= { start: item.id, end: item.id }
		if (item.id < branches[item.branch].start) {
			branches[item.branch].start = item.id
		}
		if (item.id > branches[item.branch].end) {
			branches[item.branch].end = item.id
		}
	}

	const graphWidth = 200

	const nodesByClock: Record<number, Record<string, number>> = {}
	let maxBranch = 0
	for (const item of items) {
		nodesByClock[item.message.clock] ||= {}
		nodesByClock[item.message.clock][item.id] = Object.keys(nodesByClock[item.message.clock]).length

		if (item.branch > maxBranch) {
			maxBranch = item.branch
		}
	}

	const nodes: { id: string; branch: number; x: number; y: number }[] = items.map((item) => {
		const abc = nodesByClock[item.message.clock]
		const itemsWithThisClock = Object.keys(abc).length
		const i = nodesByClock[item.message.clock][item.id]

		return {
			id: item.id,
			branch: item.branch,
			x: (graphWidth / (itemsWithThisClock + 1)) * (i + 1),
			// the +2 here is a bit magic, it's just that if we take the
			// exact centre of the div then the dot will be slightly high
			y: itemYOffsets[item.id] + 2 - divTop || 0,
		}
	})
	const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]))

	return (
		<Flex direction="row" pb="4">
			<div>
				<svg width={graphWidth} height={divHeight}>
					{links.map(([from, to], index) => {
						const f = nodesById[from]
						const t = nodesById[to]

						let strokeDashArray: string | undefined = undefined
						let path
						if (!f) {
							path = `
								M${t.x} ${t.y - 20}
								L${t.x} ${t.y}
								`
							strokeDashArray = "2,2"
						} else if (!t) {
							console.log([from, to], [f, t])
							path = `
								M${f.x} ${f.y}
								L${f.x} ${f.y + 20}
								`
							strokeDashArray = "2,2"
						} else {
							path = `
								M${f.x} ${f.y}
								L ${t.x} ${t.y}
								`
						}

						const strokeColor = color((f || t).branch.toString())

						return (
							<>
								<path
									key={`link-${index}-shadow`}
									className="link"
									d={path}
									fill="none"
									stroke={"white"}
									strokeWidth={lineStrokeWidth + 2}
									strokeDasharray={strokeDashArray}
								/>
								<path
									key={`link-${index}`}
									className="link"
									d={path}
									fill="none"
									stroke={strokeColor}
									strokeWidth={lineStrokeWidth}
									strokeDasharray={strokeDashArray}
								/>
							</>
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
									stroke="lightgray"
									strokeWidth="1px"
									d={`M${x} ${y} L${graphWidth} ${y}`}
								/>
								<path
									key={`node-${index}`}
									className="selectable node"
									data-id={index}
									stroke="black"
									strokeLinecap="round"
									strokeWidth={nodeRadius + nodeBorderRadius}
									d={`M${x} ${y} L${x} ${y}`}
								/>
								<path
									key={`node-border-${index}`}
									className="node"
									stroke="white"
									strokeLinecap="round"
									strokeWidth={nodeRadius}
									d={`M${x} ${y} L${x} ${y}`}
								/>
							</>
						)
					})}
				</svg>
			</div>
			<Flex direction="column" flexGrow="1">
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
			</Flex>
		</Flex>
	)
}
