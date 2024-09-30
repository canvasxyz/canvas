import React from "react"
import { Action, Session } from "@canvas-js/interfaces"
import { fetchAndIpldParseJson, Result } from "./utils.js"
import useSWR from "swr"
import * as d3 from "d3"
import { PropsWithChildren, useLayoutEffect, useRef, useState } from "react"
import { Box, Card, Flex } from "@radix-ui/themes"
import useCursorStack from "./useCursorStack.js"
import PaginationButton from "./components/PaginationButton.js"
import { DidPopover } from "./components/DidPopover.js"

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
				{item.message.payload.type}, id: {item.id}
				<Box flexGrow="1" />
				address:&nbsp;
				<DidPopover did={item.message.payload.did} />, clock: {item.message.clock}, branch: {item.branch}
			</Flex>
		</Card>
	)
}

type Node = {
	id: string
	branch: number
	x: number
	y: number
}

function GraphLink({
	from,
	to,
	lineStrokeWidth,
	color,
}: {
	from: Node | undefined
	to: Node | undefined
	lineStrokeWidth: number
	color: (label: string) => string
}) {
	let strokeDashArray: string | undefined = undefined
	let path
	if (!from && to) {
		path = `
			M${to.x} ${to.y - 20}
			L${to.x} ${to.y}
			`
		strokeDashArray = "2,2"
	} else if (!to && from) {
		console.log("no to")
		path = `
			M${from.x} ${from.y}
			L${from.x} ${from.y + 20}
			`
		strokeDashArray = "2,2"
	} else if (from && to) {
		path = `
				M${from.x} ${from.y}
				L ${to.x} ${to.y}
				`
	} else {
		return ""
	}

	const strokeColor = from ? color(from.branch.toString()) : to ? color(to.branch.toString()) : "black"

	return (
		<>
			<path
				key={`link-shadow`}
				className="link"
				d={path}
				fill="none"
				stroke={"white"}
				strokeWidth={lineStrokeWidth + 2}
				strokeDasharray={strokeDashArray}
			/>
			<path
				key={`link`}
				className="link"
				d={path}
				fill="none"
				stroke={strokeColor}
				strokeWidth={lineStrokeWidth}
				strokeDasharray={strokeDashArray}
			/>
		</>
	)
}

function GraphNode({
	node,
	graphWidth,
	nodeRadius,
	nodeBorderRadius,
}: {
	node: Node
	graphWidth: number
	nodeRadius: number
	nodeBorderRadius: number
}) {
	return (
		<>
			<path
				key={`node-trace-shadow`}
				stroke="white"
				strokeWidth="2px"
				d={`M${node.x} ${node.y} L${graphWidth} ${node.y}`}
			/>
			<path
				key={`node-trace`}
				stroke="lightgray"
				strokeWidth="1px"
				d={`M${node.x} ${node.y} L${graphWidth} ${node.y}`}
			/>
			<path
				key={`node`}
				className="selectable node"
				data-id={node.id}
				stroke="black"
				strokeLinecap="round"
				strokeWidth={nodeRadius + nodeBorderRadius}
				d={`M${node.x} ${node.y} L${node.x} ${node.y}`}
			/>
			<path
				key={`node-border`}
				className="node"
				stroke="white"
				strokeLinecap="round"
				strokeWidth={nodeRadius}
				d={`M${node.x} ${node.y} L${node.x} ${node.y}`}
			/>
		</>
	)
}

const entriesPerPage = 10

export default function NetworkPlot() {
	const { currentCursor, pushCursor, popCursor } = useCursorStack<string>()

	// in order to determine if another page exists, we retrieve n + 1 entries
	// if the length of the result is n + 1, then there is another page
	const params = new URLSearchParams({
		limit: (entriesPerPage + 1).toString(),
	})
	if (currentCursor) {
		params.append("gt", currentCursor)
	}

	const { data: messages, error } = useSWR(
		`/api/messages?${params.toString()}`,
		fetchAndIpldParseJson<Result<Action | Session>[]>,
		{
			refreshInterval: 1000,
		},
	)

	const [divHeight, setDivHeight] = useState(0)
	const [divTop, setDivTop] = useState(0)
	const [itemYOffsets, setItemYOffsets] = useState<Record<string, number>>({})

	if (error) return <div>failed to load</div>
	if (!messages) return <div>loading...</div>

	const hasMore = messages.length > entriesPerPage
	const messagesToDisplay = messages.slice(0, entriesPerPage)

	const color = d3.scaleOrdinal(d3.schemeDark2)

	const items = (messagesToDisplay || []).slice()
	items.sort((a, b) => {
		if (a.message.clock === b.message.clock) {
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
		<Flex direction="column" gap="2">
			<Flex direction="row" pb="4">
				<div>
					<svg width={graphWidth} height={divHeight}>
						{links.map(([from, to], index) => (
							<GraphLink
								key={index}
								from={nodesById[from]}
								to={nodesById[to]}
								color={color}
								lineStrokeWidth={lineStrokeWidth}
							/>
						))}
						{nodes.map((node, index) => {
							return (
								<GraphNode
									key={index}
									node={node}
									graphWidth={graphWidth}
									nodeRadius={nodeRadius}
									nodeBorderRadius={nodeBorderRadius}
								/>
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
								key={`${item.id}-${index}`}
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
			<Flex direction="row" gap="2">
				<Box flexGrow="1" />
				<PaginationButton text="Newer" enabled={currentCursor !== null} onClick={popCursor} />
				<PaginationButton
					text="Older"
					enabled={hasMore}
					onClick={() => pushCursor(messagesToDisplay[entriesPerPage - 1].id)}
				/>
			</Flex>
		</Flex>
	)
}
