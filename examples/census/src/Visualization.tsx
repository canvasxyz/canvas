import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

// Sample data for the graph - you can replace this with your actual data
const sampleData = {
  nodes: [
    { id: "Node 1", text: "This is the first text block" },
    { id: "Node 2", text: "Here's another text block" },
    { id: "Node 3", text: "A third block of text" },
    { id: "Node 4", text: "More text content here" },
    { id: "Node 5", text: "Final text block example" },
  ],
  links: [
    { source: "Node 1", target: "Node 2" },
    { source: "Node 1", target: "Node 3" },
    { source: "Node 2", target: "Node 4" },
    { source: "Node 3", target: "Node 4" },
    { source: "Node 4", target: "Node 5" },
  ]
};

export const Visualization = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    // Function to measure container size
    const measureContainer = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    // Initial measurement
    measureContainer();

    // Set up resize observer to detect container size changes
    const resizeObserver = new ResizeObserver(measureContainer);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Handle window resize as backup
    window.addEventListener("resize", measureContainer);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureContainer);
    };
  }, []);

  useEffect(() => {
    // Only create visualization when dimensions are available
    if (!dimensions || !svgRef.current) return;
    
    // Clear any existing visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

    // Create the force simulation
    const simulation = d3.forceSimulation(sampleData.nodes)
      .force("link", d3.forceLink(sampleData.links)
        .id((d: any) => d.id)
        .distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("radial", d3.forceRadial(200, dimensions.width / 2, dimensions.height / 2)
        .strength((d: any) => d.id === "Node 1" ? 1 : 0.1)) // Pin Node 1 to center, others weakly
      .force("collision", d3.forceCollide().radius((d: any) => {
        // Larger collision radius for central node to prevent overlaps
        if (d.id === "Node 1") {
          return 120; // Adjust based on your node size
        }
        return 80; // Regular collision radius for other nodes
      }));

    // Calculate node dimensions for proper layout
    const getNodeWidth = (d: any) => Math.max(d.text.length * 6, 100);
    const nodeHeight = 50;

    // Before starting simulation, fix the position of the central node
    sampleData.nodes.forEach((node: any) => {
      if (node.id === "Node 1") {
        node.fx = dimensions.width / 2;
        node.fy = dimensions.height / 2;
        node.fixed = true; // Mark as fixed for reference
      }
    });

    // After simulation has started, make sure to maintain the fixed position
    // This fixes a bug where the drag behavior might unset the fixed position
    simulation.on("end", () => {
      sampleData.nodes.forEach((node: any) => {
        if (node.fixed) {
          node.fx = dimensions.width / 2;
          node.fy = dimensions.height / 2;
        }
      });
    });

    // Set simulation parameters for smoother movement
    simulation
      .velocityDecay(0.6) // Add friction (higher = more friction, 0-1 range)
      .alphaDecay(0.02)   // Make the simulation cool down more slowly
      .alphaMin(0.001);   // Allow the simulation to run longer

    // Add links with improved styling
    const link = svg.append("g")
      .selectAll("line")
      .data(sampleData.links)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => {
        // Different color for links connected to the center node
        return (d.source.id === "Node 1" || d.target.id === "Node 1") ? "#6a0dad" : "#999";
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => {
        // Thicker for links connected to the center node
        return (d.source.id === "Node 1" || d.target.id === "Node 1") ? 2 : 1.5;
      });

    // Add node groups with improved drag behavior
    const nodeGroup = svg.append("g")
      .selectAll(".node-group")
      .data(sampleData.nodes)
      .enter()
      .append("g")
      .attr("class", "node-group")
      .call(d3.drag<SVGGElement, any>()
        .on("start", (event, d) => {
          if (!event.active) {
            // Use a lower alpha target for gentler movement
            simulation.alphaTarget(0.2).restart();
          }
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          // Apply smoothing to drag movement
          const dragSpeed = 0.8; // 1 = normal, <1 = slower movement
          d.fx = d.fx + (event.x - d.fx) * dragSpeed;
          d.fy = d.fy + (event.y - d.fy) * dragSpeed;
        })
        .on("end", (event, d) => {
          if (!event.active) {
            // Cool down more gently
            simulation.alphaTarget(0);
          }
          // Preserve fixed status for the center node
          if (!d.fixed) {
            d.fx = null;
            d.fy = null;
          } else {
            d.fx = dimensions.width / 2;
            d.fy = dimensions.height / 2;
          }
        })
      );

    // Modify the node styling to highlight the central node
    nodeGroup
      .append("rect")
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("fill", (d) => d.id === "Node 1" ? "#f8e8ff" : "#fff") // Different color for central node
      .attr("stroke", (d) => d.id === "Node 1" ? "#6a0dad" : "#333") // Different border for central node
      .attr("stroke-width", (d) => d.id === "Node 1" ? 2 : 1) // Thicker border for central node
      .attr("width", (d) => Math.max(d.text.length * 6, 100))
      .attr("height", 50);

    // Add text
    nodeGroup
      .append("text")
      .text((d) => d.text)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("x", (d) => Math.max(d.text.length * 6, 100) / 2)
      .attr("y", 25)
      .attr("font-family", "Arial")
      .attr("font-size", "12px")
      .attr("pointer-events", "none");

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x - Math.max(d.text.length * 6, 100) / 2},${d.y - 25})`);
    });

  }, [dimensions]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      {dimensions && (
        <svg 
          ref={svgRef} 
          width={dimensions.width} 
          height={dimensions.height}
        ></svg>
      )}
    </div>
  );
};