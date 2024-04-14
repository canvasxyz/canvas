import React, { useEffect, useRef } from "react"
import * as d3 from "d3"

interface Node extends d3.SimulationNodeDatum {
	id: string
}

interface Link {
	source: string
	target: string
}

export interface GraphProps {
	mesh: Map<string, string[]>
	nodes: Node[]
	links: Link[]
	bootstrapPeerIds: string[]

	width?: number
	height?: number
}

const nodeRadius = 10
const linkMargin = nodeRadius

export const Graph: React.FC<GraphProps> = ({ mesh, nodes, links, bootstrapPeerIds, width = 800, height = 600 }) => {
	const svgRef = useRef<SVGSVGElement>(null)
	const initRef = useRef(true)

	useEffect(() => {
		if (svgRef.current === null || initRef.current) {
			initRef.current = false
			return
		}

		const resolvedLinks = links.map((link) => ({
			...link,
			source: nodes.find((n) => n.id === link.source)!,
			target: nodes.find((n) => n.id === link.target)!,
		}))

		const simulation = d3
			.forceSimulation(nodes)
			.force(
				"link",
				d3
					.forceLink<Node, { source: Node; target: Node }>(resolvedLinks)
					.id((d) => d.id)
					.distance(100),
			)
			.force("charge", d3.forceManyBody().strength(-400))
			.force("center", d3.forceCenter(width / 2, height / 2))

		const svg = d3.select(svgRef.current).attr("width", width).attr("height", height)

		// Define the arrowhead marker
		svg
			.append("defs")
			.append("marker")
			.attr("id", "arrowhead")
			.attr("viewBox", "-0 -5 10 10") // Coordinates of the marker's bounding box
			.attr("refX", -10) // Position on the link where the marker should be attached
			.attr("refY", 0)
			.attr("markerWidth", 6) // Marker size
			.attr("markerHeight", 6)
			.attr("orient", "auto")
			.append("path")
			.attr("d", "M0,-5L10,0L0,5") // Path for the arrow shape
			.attr("class", "arrowHead")
			.style("fill", "#222")

		// Create groups for links and markers
		const linkGroup = svg.append("g").attr("class", "links")
		const markerGroup = svg.append("g").attr("class", "markers")

		const link = linkGroup
			.selectAll("line")
			.data(resolvedLinks)
			.enter()
			.append("line")
			.attr("stroke", "#999")
			.attr("stroke-opacity", 1)
			.attr("stroke-width", 1.5)

		const marker = markerGroup.selectAll("line").data(resolvedLinks).enter().append("line").attr("stroke", "none")

		const node = svg
			.append("g")
			.attr("stroke", "#fff")
			.attr("stroke-width", 2)
			.selectAll("circle")
			.data(nodes)
			.enter()
			.append("circle")
			.attr("r", nodeRadius)
			.attr("fill", (d) => (bootstrapPeerIds.includes(d.id) ? "#070" : "#700"))

		simulation.on("tick", () => {
			link
				.attr("x1", (d) => d.source.x!)
				.attr("y1", (d) => d.source.y!)
				.attr("x2", (d) => d.target.x!)
				.attr("y2", (d) => d.target.y!)

			marker
				.attr("x1", (d) => d.source.x!)
				.attr("y1", (d) => d.source.y!)
				.attr("x2", (d) => d.target.x!)
				.attr("y2", (d) => d.target.y!)
				.attr("marker-start", (d) => (mesh.get(d.source.id)?.includes(d.target.id) ? "url(#arrowhead)" : null))

			node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!)
		})

		return () => {
			simulation.stop()
		}
	}, [nodes, links, bootstrapPeerIds, width, height])

	return <svg ref={svgRef}></svg>
}
