import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

interface Node extends d3.SimulationNodeDatum {
	id: string
	topic: string | null
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
	roots: Record<string, { root: string | null }>

	bootstrapPeerIds?: string[]
	onNodeClick?: (id: string, shift: boolean, meta: boolean) => void
	onLinkClick?: (source: string, target: string) => void
}

export const nodeRadius = 10
export const width = 600
export const height = 600

const getColor = (root?: string | null) => (root ? "#" + root.slice(-6) : "#000")

const truncatePeerId = (peerId: string) => {
	return peerId.slice(0, 10) + "…" + peerId.slice(-4)
}

export const Graph: React.FC<GraphProps> = ({
	mesh,
	nodes,
	links,
	roots,
	onNodeClick = () => {},
	onLinkClick = () => {},
}) => {
	const svgRef = useRef<SVGSVGElement>(null)
	const [svg, setSvg] = useState<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null)
	const [simulation, setSimulation] = useState<d3.Simulation<Node, { source: Node; target: Node }> | null>(null)
	const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

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

		// svg.append("g").attr("class", "messages").attr("stroke-width", 0)
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

		const resolvedLinks = links.flatMap((link) => {
			const source = nodes.find((n) => n.id === link.source)
			const target = nodes.find((n) => n.id === link.target)
			if (source !== undefined && target !== undefined) {
				return [{ ...link, source, target }]
			} else {
				return []
			}
		})

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
				.attr("stroke-dasharray", (d) => {
					const sourceToTarget = d.source.id in mesh && mesh[d.source.id].includes(d.target.id)
					const targetToSource = d.target.id in mesh && mesh[d.target.id].includes(d.source.id)
					if (sourceToTarget || targetToSource) {
						return null
					} else {
						return "5,5"
					}
				})

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
	}, [svg, simulation, links, nodes, mesh])

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
			.attr("fill", (d) => getColor(rootsRef.current[d.id]?.root))
			.on("click", (event, node) => onNodeClick(node.id, event.shiftKey, event.metaKey))
			.on("mouseover", (event, node) => {
				const rect = svgRef.current!.getBoundingClientRect()
				setTooltip({
					x: event.clientX - rect.left + 10,
					y: event.clientY - rect.top - 10,
					text: truncatePeerId(node.id),
				})
			})
			.on("mouseout", () => void setTooltip(null))
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
				const { root = null } = id !== null ? (roots[id] ?? {}) : {}
				return getColor(root)
			})
	}, [svg, roots])

	return (
		<svg
			id="graph"
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
