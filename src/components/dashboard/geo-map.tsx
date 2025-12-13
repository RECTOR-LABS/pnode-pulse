"use client";

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

interface GeoNode {
  id: number;
  latitude: number;
  longitude: number;
  country: string;
  city: string;
  isActive: boolean;
  version: string | null;
}

interface ClusteredNode {
  lat: number;
  lng: number;
  count: number;
  nodes: GeoNode[];
  country: string;
}

// Simple Mercator projection
function projectPoint(lat: number, lng: number, width: number, height: number) {
  // Clamp latitude to avoid infinity at poles
  const clampedLat = Math.max(-85, Math.min(85, lat));

  const x = ((lng + 180) / 360) * width;
  const latRad = (clampedLat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = height / 2 - (mercN * width) / (2 * Math.PI);

  return { x, y };
}

// Cluster nearby nodes
function clusterNodes(nodes: GeoNode[], gridSize: number = 30): ClusteredNode[] {
  const clusters = new Map<string, ClusteredNode>();

  for (const node of nodes) {
    // Create grid key based on position
    const gridX = Math.floor(node.longitude / gridSize);
    const gridY = Math.floor(node.latitude / gridSize);
    const key = `${gridX},${gridY}`;

    if (clusters.has(key)) {
      const cluster = clusters.get(key)!;
      cluster.count++;
      cluster.nodes.push(node);
      // Update centroid
      cluster.lat = cluster.nodes.reduce((sum, n) => sum + n.latitude, 0) / cluster.nodes.length;
      cluster.lng = cluster.nodes.reduce((sum, n) => sum + n.longitude, 0) / cluster.nodes.length;
    } else {
      clusters.set(key, {
        lat: node.latitude,
        lng: node.longitude,
        count: 1,
        nodes: [node],
        country: node.country,
      });
    }
  }

  return Array.from(clusters.values());
}

// World map SVG path (simplified continents outline)
const WORLD_PATH = `M 95,42 L 102,40 L 108,37 L 115,36 L 122,38 L 128,42 L 132,47 L 135,53
L 138,47 L 145,44 L 152,42 L 160,43 L 168,47 L 175,52 L 178,58 L 175,65 L 170,70
L 163,73 L 155,74 L 147,72 L 140,68 L 135,73 L 128,77 L 120,79 L 112,78 L 105,75
L 98,70 L 92,64 L 88,57 L 86,50 L 88,45 Z
M 180,45 L 188,42 L 198,40 L 210,42 L 220,48 L 225,55 L 228,63 L 225,72 L 218,78
L 208,82 L 196,83 L 185,80 L 176,74 L 172,65 L 173,55 L 177,48 Z
M 235,55 L 248,50 L 262,48 L 278,52 L 290,60 L 295,72 L 292,85 L 282,95 L 268,100
L 252,98 L 240,92 L 232,82 L 230,70 L 232,60 Z
M 145,95 L 158,92 L 172,95 L 182,102 L 185,112 L 180,122 L 170,128 L 158,130
L 145,127 L 138,118 L 138,108 L 142,100 Z
M 260,105 L 275,102 L 290,108 L 298,118 L 295,130 L 285,138 L 270,140 L 258,135
L 252,125 L 255,112 Z
M 78,108 L 95,102 L 112,105 L 125,115 L 130,128 L 122,142 L 108,150 L 90,148
L 76,138 L 72,125 L 75,115 Z`;

export function GeoMap() {
  const [hoveredCluster, setHoveredCluster] = useState<ClusteredNode | null>(null);

  const { data, isLoading } = trpc.network.geoNodes.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const mapWidth = 400;
  const mapHeight = 200;

  // Cluster nodes for display
  const clusters = useMemo(() => {
    if (!data || data.length === 0) return [];
    return clusterNodes(data, 15); // Smaller grid for tighter clustering
  }, [data]);

  // Generate connection mesh lines between nearby clusters
  const meshLines = useMemo(() => {
    if (clusters.length < 2) return [];

    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = [];
    const maxDistance = 80; // Max pixel distance for connections

    for (let i = 0; i < clusters.length; i++) {
      const p1 = projectPoint(clusters[i].lat, clusters[i].lng, mapWidth, mapHeight);

      for (let j = i + 1; j < clusters.length; j++) {
        const p2 = projectPoint(clusters[j].lat, clusters[j].lng, mapWidth, mapHeight);
        const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

        if (distance < maxDistance) {
          lines.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            opacity: Math.max(0.05, 0.3 - distance / maxDistance * 0.25),
          });
        }
      }
    }

    return lines;
  }, [clusters]);

  if (isLoading) {
    return <GeoMapSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-12">
        No geolocation data available yet. Data will appear after the next collection cycle.
      </div>
    );
  }

  const activeCount = data.filter(n => n.isActive).length;
  const totalCount = data.length;
  const countryCount = new Set(data.map(n => n.country)).size;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            <span className="text-foreground font-medium">{totalCount}</span> nodes in{" "}
            <span className="text-foreground font-medium">{countryCount}</span> countries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-muted-foreground">{activeCount} active</span>
        </div>
      </div>

      {/* Map container */}
      <div className="relative w-full aspect-[2/1] bg-[#0d1421] rounded-lg overflow-hidden">
        <svg
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Background gradient */}
          <defs>
            <radialGradient id="geo-bg-gradient" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#1a2332" />
              <stop offset="100%" stopColor="#0d1421" />
            </radialGradient>
            <filter id="geo-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={mapWidth} height={mapHeight} fill="url(#geo-bg-gradient)" />

          {/* Simplified world outline (decorative dots pattern) */}
          <g opacity="0.15">
            {Array.from({ length: 40 }, (_, i) => (
              <g key={`row-${i}`}>
                {Array.from({ length: 80 }, (_, j) => (
                  <circle
                    key={`dot-${i}-${j}`}
                    cx={j * 5 + 2.5}
                    cy={i * 5 + 2.5}
                    r="0.5"
                    fill="currentColor"
                  />
                ))}
              </g>
            ))}
          </g>

          {/* Connection mesh lines */}
          <g>
            {meshLines.map((line, i) => (
              <line
                key={`mesh-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#64748b"
                strokeWidth="0.5"
                strokeOpacity={line.opacity}
              />
            ))}
          </g>

          {/* Node clusters */}
          <g>
            {clusters.map((cluster, i) => {
              const { x, y } = projectPoint(cluster.lat, cluster.lng, mapWidth, mapHeight);
              const isHovered = hoveredCluster === cluster;
              const radius = Math.min(12, 4 + Math.sqrt(cluster.count) * 2);
              const activeInCluster = cluster.nodes.filter(n => n.isActive).length;
              const allActive = activeInCluster === cluster.count;

              return (
                <g
                  key={`cluster-${i}`}
                  transform={`translate(${x}, ${y})`}
                  onMouseEnter={() => setHoveredCluster(cluster)}
                  onMouseLeave={() => setHoveredCluster(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Pulse ring for active clusters */}
                  {allActive && (
                    <circle
                      r={radius}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="1"
                      opacity="0.4"
                    >
                      <animate
                        attributeName="r"
                        values={`${radius};${radius + 6};${radius}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.4;0;0.4"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Main circle */}
                  <circle
                    r={isHovered ? radius + 2 : radius}
                    fill={allActive ? "#10B981" : "#64748b"}
                    filter={isHovered ? "url(#geo-glow)" : undefined}
                    style={{ transition: "r 0.2s ease-out" }}
                  />

                  {/* Count label */}
                  {cluster.count > 1 && (
                    <text
                      y="0.35em"
                      textAnchor="middle"
                      fill="white"
                      fontSize={radius > 6 ? "6" : "4"}
                      fontWeight="600"
                    >
                      {cluster.count}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredCluster && (
          <div
            className="absolute pointer-events-none bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 text-xs z-10"
            style={{
              left: `${(projectPoint(hoveredCluster.lat, hoveredCluster.lng, 100, 50).x)}%`,
              top: `${(projectPoint(hoveredCluster.lat, hoveredCluster.lng, 100, 50).y)}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="font-medium text-foreground">
              {hoveredCluster.nodes[0]?.city || "Unknown"}, {hoveredCluster.country}
            </div>
            <div className="text-muted-foreground mt-1">
              {hoveredCluster.count} node{hoveredCluster.count > 1 ? "s" : ""}
            </div>
            {hoveredCluster.count <= 3 && (
              <div className="mt-1 space-y-0.5">
                {hoveredCluster.nodes.map((node, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        node.isActive ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    />
                    <span className="text-muted-foreground">v{node.version || "?"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs">
          <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <span>RPC nodes</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function GeoMapSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
      <div className="w-full aspect-[2/1] bg-muted rounded-lg" />
    </div>
  );
}
