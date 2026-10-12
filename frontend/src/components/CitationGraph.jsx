import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getCitationGraphApi } from "../services/exportApi";

export default function CitationGraph({ threadId, initialGraphData }) {
  const svgRef = useRef(null);
  const [graphData, setGraphData] = useState(initialGraphData || null);
  const [loading, setLoading] = useState(!initialGraphData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialGraphData) {
      setGraphData(initialGraphData);
      setLoading(false);
      return;
    }

    if (!threadId) return;

    setLoading(true);
    getCitationGraphApi(threadId)
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("⚠️ CitationGraph fetch error:", err.message);
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  }, [threadId, initialGraphData]);

  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0 || !svgRef.current) return;

    const width = 600;
    const height = 230;

    // Clear previous SVG contents
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height);

    // Zoom container
    const g = svg.append("g");

    const zoom = d3.zoom().on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

    svg.call(zoom);

    // Clone nodes and links to prevent direct mutation of state
    const nodes = graphData.nodes.map((d) => ({ ...d }));
    const links = (graphData.edges || []).map((d) => ({ ...d }));

    // Force simulation tuned for compact layout
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(95)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(28));

    // Render links
    const link = g
      .append("g")
      .attr("stroke", "var(--line-bright, #94a3b8)")
      .attr("stroke-opacity", 0.7)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => Math.sqrt(d.value || 1) * 1.8);

    // Node group
    const node = g
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => (d.group === "Act" ? 16 : d.group === "PRECEDENT" ? 12 : 9))
      .attr("fill", (d) => {
        if (d.group === "Act") return "#f59e0b"; // Gold / Amber
        if (d.group === "PRECEDENT") return "#a855f7"; // Purple
        if (d.group === "RULE") return "#06b6d4"; // Cyan
        return "#3b82f6"; // Blue
      })
      .attr("stroke", "var(--surface, #ffffff)")
      .attr("stroke-width", 2);

    // Node text labels
    node
      .append("text")
      .text((d) => d.label)
      .attr("x", 12)
      .attr("y", 4)
      .attr("fill", "var(--ink, #1e293b)")
      .attr("font-size", "11px")
      .attr("font-family", "var(--font-mono, monospace)")
      .attr("font-weight", (d) => (d.group === "Act" ? "bold" : "600"));

    // Tooltip hover title
    node.append("title").text((d) => `${d.label} (${d.group})`);

    // Simulation tick updates
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [graphData]);

  if (loading) {
    return (
      <div className="p-4 text-center text-xs font-mono text-[var(--brass)] animate-pulse border border-[var(--line)] rounded-xl bg-[var(--surface)]">
        🌐 Building Statutory Citation Co-Occurrence Network...
      </div>
    );
  }

  if (error || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="p-3 text-center text-xs font-mono text-[var(--ink-dim)] italic border border-[var(--line)] rounded-xl bg-[var(--surface)]">
        Citation network graph available after verdict adjudication.
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-xl border border-[var(--line)] shadow-lg space-y-3"
      style={{ backgroundColor: "var(--surface)", color: "var(--ink)", maxWidth: "100%" }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-serif font-semibold text-[var(--ink)] flex items-center gap-2">
          <span>🌐</span> Statutory Citation Co-Occurrence Network
        </h4>
        <span className="text-xs font-mono text-[var(--brass)] px-2 py-0.5 rounded bg-[var(--brass-light)] border border-[var(--line-bright)]">
          D3 Force Layout
        </span>
      </div>

      <div
        className="border border-[var(--line)] rounded-lg overflow-hidden"
        style={{ backgroundColor: "var(--bg)", height: "230px" }}
      >
        <svg ref={svgRef}></svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-[var(--ink-muted)] pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Act Root
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Statutory Section
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Precedent Case
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> Official Rule
        </span>
      </div>
    </div>
  );
}
