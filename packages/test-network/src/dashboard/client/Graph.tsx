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

	bootstrapPeerIds?: string[]
	messages?: { peerId: string; data: string }[]
	onClick?: (id: string) => void
}

export const nodeRadius = 10
export const width = 800
export const height = 600

export const Graph: React.FC<GraphProps> = ({
	mesh,
	nodes,
	links,
	bootstrapPeerIds = [],
	messages = [],
	onClick = () => {},
}) => {
	const svgRef = useRef<SVGSVGElement>(null)
	const [svg, setSvg] = useState<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
	const [simulation, setSimulation] = useState<d3.Simulation<Node, { source: Node; target: Node }> | null>(null)

	// Initialize simulation
	useEffect(() => {
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
			.force("center", d3.forceCenter(width / 2, height / 2))

		setSimulation(simulation)
		return () => void simulation.stop()
	}, [])

	useEffect(() => {
		if (svgRef.current === null) {
			return
		}

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
		svg.append("g").attr("class", "links").attr("stroke", "#999").attr("stroke-opacity", 1).attr("stroke-width", 1.5)
		svg.append("g").attr("class", "markers")
		svg.append("g").attr("class", "nodes").attr("stroke", "#fff").attr("stroke-width", 2)

		setSvg(svg)
	}, [])

	useEffect(() => {
		if (svg === null || simulation === null) {
			return
		}

		const resolvedLinks = links.map((link) => ({
			...link,
			source: nodes.find((n) => n.id === link.source)!,
			target: nodes.find((n) => n.id === link.target)!,
		}))

		const resolvedMessages = messages.map(({ data, peerId }) => ({ data, node: nodes.find((n) => n.id === peerId)! }))

		simulation.nodes(nodes)
		simulation.force<d3.ForceLink<Node, { id: string; source: Node; target: Node }>>("link")!.links(resolvedLinks)
		simulation.alpha(1).restart()

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
			.merge(oldMessages)

		const oldLinks = svg
			.select<SVGGElement>(".links")
			.selectAll<SVGLineElement, { id: string; source: Node; target: Node }>("line")
			.data(resolvedLinks, (d) => d.id)

		oldLinks.exit().remove()
		const newLinks = oldLinks.enter().append("line").merge(oldLinks)

		const oldMarkers = svg
			.select<SVGGElement>(".markers")
			.selectAll<SVGLineElement, { id: string; source: Node; target: Node }>("line")
			.data(resolvedLinks, (d) => d.id)

		oldMarkers.exit().remove()
		const newMarkers = oldMarkers.enter().append("line").attr("stroke", "none").merge(oldMarkers)

		const oldNodes = svg
			.select<SVGGElement>(".nodes")
			.selectAll<SVGCircleElement, Node>("circle")
			.data(nodes, (d) => d.id)

		const newNodes = oldNodes
			.enter()
			.append("circle")
			.attr("r", nodeRadius)
			.attr("fill", (d) => (bootstrapPeerIds.includes(d.id) ? "#070" : "#700"))
			.on("click", (event, node) => onClick(node.id))
			.merge(oldNodes)

		simulation.on("tick", () => {
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

			newNodes.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!)
			newMessages.attr("cx", (d) => d.node.x!).attr("cy", (d) => d.node.y!)
		})

		return () => void simulation.on("tick", null)
	}, [svg, simulation, mesh, nodes, links, messages])

	return <svg width={width} height={height} ref={svgRef}></svg>
}
