"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatBytes } from "@/lib/utils/format";

interface GraphNode {
  id: number;
  label: string;
  version: string | null;
  isActive: boolean;
  storage: number;
  normalizedSize: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: number;
  target: number;
}

// Version color mapping
const VERSION_COLORS: Record<string, string> = {
  "0.6.0": "hsl(var(--brand-500))",
  "0.5.1": "hsl(var(--status-warning))",
  "0.5.0": "hsl(var(--status-inactive))",
};

const DEFAULT_COLOR = "hsl(var(--muted-foreground))";

export function NetworkMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const { data, isLoading } = trpc.network.peerGraph.useQuery(
    { limit: 100 },
    { refetchInterval: 60000 }
  );

  // Initialize node positions using force simulation
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [simulationComplete, setSimulationComplete] = useState(false);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(400, containerRef.current.clientHeight),
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Simple force simulation
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize nodes with random positions
    const initialNodes: GraphNode[] = data.nodes.map((n, i) => ({
      ...n,
      x: centerX + (Math.random() - 0.5) * width * 0.8,
      y: centerY + (Math.random() - 0.5) * height * 0.8,
      vx: 0,
      vy: 0,
    }));

    // Create adjacency map for quick edge lookup
    const adjacencyMap = new Map<number, Set<number>>();
    data.edges.forEach((e) => {
      if (!adjacencyMap.has(e.source)) adjacencyMap.set(e.source, new Set());
      if (!adjacencyMap.has(e.target)) adjacencyMap.set(e.target, new Set());
      adjacencyMap.get(e.source)!.add(e.target);
      adjacencyMap.get(e.target)!.add(e.source);
    });

    // Run force simulation
    const iterations = 100;
    const repulsionStrength = 500;
    const attractionStrength = 0.01;
    const centerStrength = 0.01;
    const dampening = 0.9;

    for (let iter = 0; iter < iterations; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < initialNodes.length; i++) {
        for (let j = i + 1; j < initialNodes.length; j++) {
          const nodeA = initialNodes[i];
          const nodeB = initialNodes[j];
          const dx = nodeB.x! - nodeA.x!;
          const dy = nodeB.y! - nodeA.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsionStrength / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodeA.vx! -= fx;
          nodeA.vy! -= fy;
          nodeB.vx! += fx;
          nodeB.vy! += fy;
        }
      }

      // Attraction along edges
      data.edges.forEach((edge) => {
        const nodeA = initialNodes.find((n) => n.id === edge.source);
        const nodeB = initialNodes.find((n) => n.id === edge.target);
        if (!nodeA || !nodeB) return;
        const dx = nodeB.x! - nodeA.x!;
        const dy = nodeB.y! - nodeA.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * attractionStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodeA.vx! += fx;
        nodeA.vy! += fy;
        nodeB.vx! -= fx;
        nodeB.vy! -= fy;
      });

      // Center gravity
      initialNodes.forEach((node) => {
        node.vx! += (centerX - node.x!) * centerStrength;
        node.vy! += (centerY - node.y!) * centerStrength;
      });

      // Apply velocities
      initialNodes.forEach((node) => {
        node.x! += node.vx!;
        node.y! += node.vy!;
        node.vx! *= dampening;
        node.vy! *= dampening;

        // Keep within bounds
        node.x = Math.max(50, Math.min(width - 50, node.x!));
        node.y = Math.max(50, Math.min(height - 50, node.y!));
      });
    }

    setNodes(initialNodes);
    setSimulationComplete(true);
  }, [data, dimensions]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).tagName === "rect") {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(3, prev.scale * delta)),
    }));
  }, []);

  // Get node color by version
  const getNodeColor = (node: GraphNode) => {
    if (!node.isActive) return "hsl(var(--status-inactive))";
    return VERSION_COLORS[node.version || ""] || DEFAULT_COLOR;
  };

  // Get node radius based on storage
  const getNodeRadius = (node: GraphNode) => {
    const minRadius = 6;
    const maxRadius = 20;
    return minRadius + node.normalizedSize * (maxRadius - minRadius);
  };

  // Get unique versions for legend
  const versions = useMemo(() => {
    if (!data) return [];
    const unique = new Set(data.nodes.map((n) => n.version).filter(Boolean));
    return Array.from(unique).sort().reverse();
  }, [data]);

  if (isLoading || !simulationComplete) {
    return <NetworkMapSkeleton />;
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No network data available yet. Data will appear after nodes discover peers.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">{data.stats.nodeCount} nodes, {data.stats.edgeCount} connections</span>
        </div>
        <div className="flex items-center gap-3">
          {versions.slice(0, 4).map((version) => (
            <div key={version} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: VERSION_COLORS[version || ""] || DEFAULT_COLOR }}
              />
              <span>v{version}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-muted" />
            <span>Inactive</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 transition-colors"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="relative w-full h-[500px] bg-muted/30 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
        >
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Background for pan events */}
            <rect
              x={0}
              y={0}
              width={dimensions.width}
              height={dimensions.height}
              fill="transparent"
            />

            {/* Edges */}
            {data.edges.map((edge, i) => {
              const sourceNode = nodes.find((n) => n.id === edge.source);
              const targetNode = nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;
              const isHighlighted =
                hoveredNode &&
                (hoveredNode.id === edge.source || hoveredNode.id === edge.target);
              return (
                <line
                  key={`edge-${i}`}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isHighlighted ? "hsl(var(--brand-500))" : "currentColor"}
                  strokeOpacity={isHighlighted ? 0.8 : 0.15}
                  strokeWidth={isHighlighted ? 2 : 1}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNode?.id === node.id;
              const radius = getNodeRadius(node);
              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + (isSelected || isHovered ? 3 : 0)}
                    fill={getNodeColor(node)}
                    stroke={isSelected ? "hsl(var(--foreground))" : isHovered ? "hsl(var(--brand-500))" : "transparent"}
                    strokeWidth={2}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(selectedNode?.id === node.id ? null : node);
                    }}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredNode && !selectedNode && (
          <div
            className="absolute pointer-events-none bg-popover border border-border rounded-lg shadow-lg p-2 text-xs z-10"
            style={{
              left: (hoveredNode.x! * transform.scale + transform.x) + 20,
              top: (hoveredNode.y! * transform.scale + transform.y) - 20,
            }}
          >
            <div className="font-medium">{hoveredNode.label}</div>
            <div className="text-muted-foreground">v{hoveredNode.version || "unknown"}</div>
            <div className="text-muted-foreground">{formatBytes(hoveredNode.storage)}</div>
          </div>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 bg-popover border border-border rounded-lg shadow-lg p-4 w-64 z-10">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium">{selectedNode.label}</div>
                <div className="text-xs text-muted-foreground">
                  v{selectedNode.version || "unknown"}
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-muted rounded"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className={selectedNode.isActive ? "text-status-active" : "text-status-inactive"}>
                  {selectedNode.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage:</span>
                <span>{formatBytes(selectedNode.storage)}</span>
              </div>
            </div>
            <Link
              href={`/nodes/${selectedNode.id}`}
              className="block mt-3 text-center text-sm text-brand-500 hover:text-brand-600 transition-colors"
            >
              View Details
            </Link>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground text-center">
        Drag to pan, scroll to zoom. Click nodes for details. Node size = storage capacity.
      </div>
    </div>
  );
}

function NetworkMapSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-48 bg-muted rounded" />
      </div>
      <div className="h-[500px] bg-muted/30 rounded-lg" />
    </div>
  );
}
