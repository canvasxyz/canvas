import { Action, Message, Session } from "@canvas-js/interfaces"
import * as d3 from "d3"

type DisplayNode = {
	id: string
	x: number
	y: number
	label_upper: string
	label_lower: string
	clock: number
	branch: number
}

type Link = {
	i: number
	source: Message<Action | Session> & { branch: number; id: string }
	target: Message<Action | Session> & { branch: number; id: string }
	bundle: Bundle
}

type DisplayLink = {
	yt: number
	ys: number
	xt: number
	xs: number
	xb: number
	c1: number
	c2: number
}

type Bundle = {
	id: string
	branch: number
	clock: number
	parents: (Message<Action | Session> & { branch: number; id: string })[]
	level: number
	span: number
	links: Link[]
	x?: number
	y?: number
	i?: number
}

const constructTangleLayout = (
	messageList: (Message<Action | Session> & { branch: number; id: string })[],
	options?: { c?: number; bigc?: number },
) => {
	// sort messages by clock and then branch, ascending
	messageList.sort((a, b) => a.clock - b.clock || a.branch - b.branch)

	const messagesById = Object.fromEntries(messageList.map((m) => [m.id, m]))

	// bucket messages by level
	let maxClock = 0
	const messageIdsByLevel: Record<string, string[]> = {}
	for (const message of messageList) {
		if (message.clock > maxClock) maxClock = message.clock
		if (!messageIdsByLevel[message.clock]) messageIdsByLevel[message.clock] = []
		messageIdsByLevel[message.clock].push(message.id)
	}

	// rearrange into a list of lists
	const levels = []
	for (let i = 0; i <= maxClock; i++) {
		levels.push({ nodes: messageIdsByLevel[i] || [] })
	}

	const nodeParents = Object.fromEntries(messageList.map((m) => [m.id, m.parents.map((id) => messagesById[id])]))
	const nodeBundleMap: Record<string, Bundle> = {}

	const levelBundles: Record<string, Bundle[]> = {}

	// precompute bundles
	levels.forEach((l, i) => {
		const index: Record<string, Bundle> = {}
		l.nodes.forEach((nodeId) => {
			const parentNodes = nodeParents[nodeId]
			if (parentNodes.length == 0) {
				return
			}

			const n = messagesById[nodeId]

			const id = parentNodes
				.map((d) => d.id)
				.sort()
				.join("-X-")
			if (id in index) {
				index[id].parents = index[id].parents.concat(parentNodes)
			} else {
				index[id] = {
					i,
					id: id,
					branch: n.branch,
					clock: n.clock,
					parents: parentNodes.slice(),
					level: i,
					span: i - d3.min(parentNodes, (p) => p.branch)!,
					links: [],
				}
			}
			nodeBundleMap[n.id] = index[id]
		})
		levelBundles[i] = Object.keys(index).map((k) => index[k])
	})

	const links: Link[] = []
	let link_idx = 0
	for (const node of messageList) {
		for (const parent of nodeParents[node.id]) {
			links.push({ i: link_idx, source: node, bundle: nodeBundleMap[node.id], target: parent })
			link_idx++
		}
	}

	const bundles = Object.values(levelBundles).flat()
	const parentBundleIndex: Record<string, Record<string, Bundle[]>> = {}

	// reverse pointer from parent to bundles
	// node.bundles_index
	bundles.forEach((b) =>
		b.parents.forEach((p) => {
			parentBundleIndex[p.id] ||= {}
			parentBundleIndex[p.id][b.id] ||= []
			parentBundleIndex[p.id][b.id].push(b)
		}),
	)

	// node.bundles
	const nodeBundlesMap: Record<string, Bundle[][]> = {}
	messageList.forEach((n) => {
		if (parentBundleIndex[n.id] !== undefined) {
			nodeBundlesMap[n.id] = Object.keys(parentBundleIndex[n.id]).map((k) => parentBundleIndex[n.id][k])
		} else {
			parentBundleIndex[n.id] = {}
			nodeBundlesMap[n.id] = []
		}
		nodeBundlesMap[n.id].sort((a, b) =>
			d3.descending(
				d3.max(a, (d) => d.span),
				d3.max(b, (d) => d.span),
			),
		)
		// nodeBundlesMap[n.id].forEach((b, i) => (b.i = i))
	})

	links.forEach((l) => {
		if (l.bundle === undefined) {
			return
		}
		if (l.bundle.links === undefined) {
			l.bundle.links = []
		}
		l.bundle.links.push(l)
	})

	// layout
	const padding = 32
	const node_height = 64
	const node_width = 200
	const bundle_width = 14
	const metro_d = 4

	options ||= {}
	options.c ||= 16
	const c = options.c
	options.bigc ||= node_width + c

	const displayNodes: DisplayNode[] = []
	const displayNodesById: Record<string, DisplayNode> = {}

	const x_offset = padding
	const y_offset = padding
	levels.forEach((l, level_idx) => {
		l.nodes.forEach((messageId, i) => {
			const node = messagesById[messageId]
			const displayNode = {
				id: node.id,
				label_upper: node.payload.type,
				label_lower: node.payload.type == "action" ? node.payload.name : node.payload.did.split(":")[4],
				clock: node.clock,
				branch: node.branch,
				x: (node.clock - 1) * node_width + x_offset,
				y: node.branch * node_height + y_offset,
			}
			displayNodes.push(displayNode)
			displayNodesById[node.id] = displayNode
		})
	})

	let i = 0
	levels.forEach((l, level_idx) => {
		levelBundles[level_idx].forEach((b) => {
			b.x =
				d3.max(b.parents, (d) => displayNodesById[d.id].x)! +
				node_width +
				(levelBundles[level_idx].length - 1 - b.i!) * bundle_width
			b.y = 0
		})
		i += l.nodes.length
	})

	const displayLinks: DisplayLink[] = links.map((l, i) => {
		const targetDisplayNode = displayNodesById[l.target.id]
		const sourceDisplayNode = displayNodesById[l.source.id]
		return {
			xt: targetDisplayNode.x,
			yt: targetDisplayNode.y,
			xb: l.bundle.x!,
			yb: l.bundle.y!,
			xs: sourceDisplayNode.x,
			ys: sourceDisplayNode.y,
			c1: c,
			c2: c,
		}
	})

	const layout = {
		width: d3.max(displayNodes, (n) => n.x)! + node_width + 2 * padding,
		height: d3.max(displayNodes, (n) => n.y)! + node_height / 2 + 2 * padding,
		node_height,
		node_width,
		bundle_width,
		metro_d,
	}

	return { levels, nodes: displayNodes, links: displayLinks, bundles, layout }
}

export const NetworkChart = ({
	data,
	...options
}: {
	data: (Message<Action | Session> & { branch: number; id: string })[]
	c?: number
	bigc?: number
	keysToHighlight?: string[] | Set<string>
	color?: (i: string) => ReturnType<typeof d3.color>
}) => {
	const tangleLayout = constructTangleLayout(data, options)

	const color = d3.scaleOrdinal(d3.schemeDark2)

	const background_color = "white"
	console.log(tangleLayout)

	return (
		<svg
			width={tangleLayout.layout.width}
			height={tangleLayout.layout.height}
			style={{ backgroundColor: background_color }}
		>
			{tangleLayout.bundles.map((b, i) => {
				// group links by target branch
				const linksByBranch: Record<string, Link[]> = {}
				for (const l of b.links) {
					const branch = l.source.branch
					if (!linksByBranch[branch]) {
						linksByBranch[branch] = []
					}
					linksByBranch[branch].push(l)
				}

				const result = []

				for (const row of Object.entries(linksByBranch)) {
					const group = row[1]
					const groupResult = []
					for (const l_ of group) {
						const l = tangleLayout.links[l_.i]

						let result
						if (l.yt < l.ys) {
							result = `
            M${l.xt} ${l.yt}
            L${l.xb - l.c1} ${l.yt}
            A${l.c1} ${l.c1} 90 0 1 ${l.xb} ${l.yt + l.c1}
            L${l.xb} ${l.ys - l.c2}
            A${l.c2} ${l.c2} 90 0 0 ${l.xb + l.c2} ${l.ys}
            L${l.xs} ${l.ys}
          `
						} else if (l.yt == l.ys) {
							result = `
            M${l.xt} ${l.yt}
            L${l.xs} ${l.ys}
          `
						} else {
							result = `
            M${l.xt} ${l.yt}
            L${l.xb - l.c1} ${l.yt}
            A${l.c1} ${l.c1} -270 0 0 ${l.xb} ${l.yt - l.c1}
            L${l.xb} ${l.ys + l.c2}
            A${l.c2} ${l.c2} -270 0 1 ${l.xb + l.c2} ${l.ys}
            L${l.xs} ${l.ys}
          `
						}
						groupResult.push(result)
					}

					result.push(
						<path
							key={`bundle-${b.id}-branch-${row[0]}-background`}
							className="link"
							d={groupResult.join("")}
							fill="none"
							stroke={background_color}
							strokeWidth="5"
						/>,
					)
					result.push(
						<path
							key={`bundle-${b.id}-branch-${row[0]}`}
							className="link"
							d={groupResult.join("")}
							fill="none"
							stroke={color(row[0])}
							strokeWidth="2"
						/>,
					)
				}

				return result
			})}

			{tangleLayout.nodes.map((n) => (
				<>
					<path
						className="selectable node"
						data-id={n.id}
						stroke="black"
						strokeLinecap="round"
						strokeWidth="8"
						d={`M${n.x} ${n.y} L${n.x} ${n.y}`}
					/>
					<path className="node" stroke="white" strokeWidth="4" d={`M${n.x} ${n.y} L${n.x} ${n.y}`} />

					<text
						className="selectable"
						data-id={n.id}
						x={n.x + 4}
						y={n.y - 4}
						stroke={background_color}
						strokeWidth="4"
						style={{ fontFamily: "sans-serif", fontSize: "10px" }}
					>
						{n.label_upper}
					</text>
					<text x={n.x + 4} y={n.y - 4} style={{ pointerEvents: "none", fontFamily: "sans-serif", fontSize: "10px" }}>
						{n.label_upper}
					</text>
					<text x={n.x + 4} y={n.y + 12} style={{ pointerEvents: "none", fontFamily: "sans-serif", fontSize: "10px" }}>
						{n.label_lower}
					</text>
				</>
			))}
		</svg>
	)
}
