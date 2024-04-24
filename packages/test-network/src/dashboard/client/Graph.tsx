import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface Node extends d3.SimulationNodeDatum {
	id: string
}

interface Link {
	id: string
	source: string
	target: string
}

export interface GraphProps {
	mesh: Record<string, string[]>
	nodes: Node[]
	links: Link[]
	roots: Record<string, string>

	bootstrapPeerIds?: string[]
	messages?: { peerId: string; data: string }[]
	onNodeClick?: (id: string) => void
	onLinkClick?: (source: string, target: string) => void
}

export const nodeRadius = 10
export const width = 800
export const height = 600

export const Graph: React.FC<GraphProps> = ({
	mesh,
	nodes,
	links,
	roots,
	bootstrapPeerIds = [],
	messages = [],
	onNodeClick = () => {},
	onLinkClick = () => {},
}) => {
	const svgRef = useRef<SVGSVGElement>(null)
	const [svg, setSvg] = useState<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
	const [simulation, setSimulation] = useState<d3.Simulation<Node, { source: Node; target: Node }> | null>(null)

	useEffect(() => {
		if (svgRef.current === null) {
			return
		}

		const simulation = d3
			.forceSimulation<Node>()
			.force(
				"link",
				d3
					.forceLink<Node, { source: Node; target: Node }>()
					.id((d) => d.id)
					.distance(100),
			)
			.force("charge", d3.forceManyBody().strength(-400))
			.force("x", d3.forceX(width / 2))
			.force("y", d3.forceY(height / 2))

		setSimulation(simulation)

		const svg = d3.select(svgRef.current).attr("width", width).attr("height", height)

		// Define the arrowhead marker
		svg
			.append("defs")
			.append("marker")
			.attr("id", "arrowhead")
			.attr("viewBox", "-0 -5 10 10") // Coordinates of the marker's bounding box
			.attr("refX", -10) // Position on the link where the marker should be attached
			.attr("refY", 0)
			.attr("markerWidth", 10) // Marker size
			.attr("markerHeight", 10)
			.attr("orient", "auto")
			.append("path")
			.attr("d", "M0,-5L10,0L0,5") // Path for the arrow shape
			.attr("class", "arrowHead")
			.style("fill", "#222")

		svg.append("g").attr("class", "messages").attr("stroke-width", 0)
		svg.append("g").attr("class", "links").attr("stroke", "#999").attr("stroke-opacity", 1).attr("stroke-width", 4)
		svg.append("g").attr("class", "markers")
		svg.append("g").attr("class", "nodes").attr("stroke", "#fff").attr("stroke-width", 2)

		setSvg(svg)

		return () => void simulation.stop()
	}, [])

	const [isMouseDown, setIsMouseDown] = useState(false)
	const isMouseDownRef = useRef(isMouseDown)

	useEffect(() => {
		if (svg === null || simulation === null) {
			return
		}

		const resolvedLinks = links.map((link) => ({
			...link,
			source: nodes.find((n) => n.id === link.source)!,
			target: nodes.find((n) => n.id === link.target)!,
		}))

		simulation.force<d3.ForceLink<Node, { id: string; source: Node; target: Node }>>("link")!.links(resolvedLinks)
		simulation.alpha(1).restart()

		const oldLinks = svg
			.select<SVGGElement>(".links")
			.selectAll<SVGLineElement, { id: string; source: Node; target: Node }>("line")
			.data(resolvedLinks, (d) => d.id)

		oldLinks.exit().remove()
		const newLinks = oldLinks
			.enter()
			.append("line")
			.on("click", (event, { source, target }) => onLinkClick(source.id, target.id))
			.on("mouseenter", (event, { source, target }) => {
				if (isMouseDownRef.current) {
					onLinkClick(source.id, target.id)
				}
			})
			.merge(oldLinks)

		const oldMarkers = svg
			.select<SVGGElement>(".markers")
			.selectAll<SVGLineElement, { id: string; source: Node; target: Node }>("line")
			.data(resolvedLinks, (d) => d.id)

		oldMarkers.exit().remove()
		const newMarkers = oldMarkers.enter().append("line").attr("stroke", "none").merge(oldMarkers)

		simulation.on("tick.links", () => {
			newLinks
				.attr("x1", (d) => d.source.x!)
				.attr("y1", (d) => d.source.y!)
				.attr("x2", (d) => d.target.x!)
				.attr("y2", (d) => d.target.y!)

			newMarkers
				.attr("x1", (d) => d.source.x!)
				.attr("y1", (d) => d.source.y!)
				.attr("x2", (d) => d.target.x!)
				.attr("y2", (d) => d.target.y!)
				.attr("marker-start", (d) => {
					if (d.source.id in mesh && mesh[d.source.id].includes(d.target.id)) {
						return "url(#arrowhead)"
					} else {
						return null
					}
				})
		})

		return () => void simulation.on("tick.links", null)
	}, [svg, simulation, links, mesh])

	const rootsRef = useRef(roots)

	useEffect(() => {
		if (svg === null || simulation === null) {
			return
		}

		simulation.nodes(nodes)
		simulation.alpha(1).restart()

		const oldNodes = svg
			.select<SVGGElement>(".nodes")
			.selectAll<SVGCircleElement, Node>("circle")
			.data(nodes, (d) => d.id)

		oldNodes.exit().remove()

		const newNodes = oldNodes
			.enter()
			.append("circle")
			.attr("r", nodeRadius)
			.attr("data-id", (d) => d.id)
			.attr("fill", (d) => rootsRef.current[d.id] ?? "#fff")
			.on("click", (event, node) => onNodeClick(node.id))
			.merge(oldNodes)

		simulation.on("tick.nodes", () => {
			newNodes.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!)
		})

		return () => void simulation.on("tick.nodes", null)
	}, [svg, simulation, nodes])

	useEffect(() => {
		if (svg === null) {
			return
		}

		rootsRef.current = roots

		svg
			.select<SVGGElement>(".nodes")
			.selectAll<SVGCircleElement, Node>("circle")
			.attr("fill", (d, idx, elems) => {
				const id = elems[idx].getAttribute("data-id")
				if (id && roots[id]) {
					return `#${roots[id].slice(0, 6)}`
				} else {
					return "#000"
				}
			})
	}, [svg, roots])

	useEffect(() => {
		if (svg === null || simulation === null) {
			return
		}

		const resolvedMessages = messages.map(({ data, peerId }) => ({ data, node: nodes.find((n) => n.id === peerId)! }))

		const oldMessages = svg
			.select<SVGGElement>(".messages")
			.selectAll<SVGCircleElement, { data: string; node: Node }>("circle")
			.data(resolvedMessages, (d) => `${d.node.id}/${d.data}`)

		oldMessages.exit().remove()

		const newMessages = oldMessages
			.enter()
			.append("circle")
			.attr("r", nodeRadius * 1.5)
			.attr("fill", (d) => "#007")
			.attr("cx", (d) => d.node.x!)
			.attr("cy", (d) => d.node.y!)
			.merge(oldMessages)

		simulation.on("tick.messages", () => {
			newMessages.attr("cx", (d) => d.node.x!).attr("cy", (d) => d.node.y!)
		})

		return () => void simulation.on("tick.messages", null)
	}, [svg, simulation, nodes, messages])

	return (
		<svg
			style={{ cursor: isMouseDown ? "crosshair" : "initial" }}
			width={width}
			height={height}
			ref={svgRef}
			onMouseDown={() => setIsMouseDown((isMouseDownRef.current = true))}
			onMouseUp={() => setIsMouseDown((isMouseDownRef.current = false))}
			onMouseLeave={() => setIsMouseDown((isMouseDownRef.current = false))}
		></svg>
	)
}
