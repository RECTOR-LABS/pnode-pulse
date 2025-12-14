"use client";

import { useMemo, useState, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { trpc } from "@/lib/trpc";

// World map topology (low resolution for performance)
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

// Cluster nearby nodes
function clusterNodes(nodes: GeoNode[], gridSize: number = 15): ClusteredNode[] {
  const clusters = new Map<string, ClusteredNode>();

  for (const node of nodes) {
    const gridX = Math.floor(node.longitude / gridSize);
    const gridY = Math.floor(node.latitude / gridSize);
    const key = `${gridX},${gridY}`;

    if (clusters.has(key)) {
      const cluster = clusters.get(key)!;
      cluster.count++;
      cluster.nodes.push(node);
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

// Memoized geography component for performance
const MapGeographies = memo(function MapGeographies() {
  return (
    <Geographies geography={GEO_URL}>
      {({ geographies }) =>
        geographies.map((geo) => (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill="#1e293b"
            stroke="#334155"
            strokeWidth={0.5}
            style={{
              default: { outline: "none" },
              hover: { outline: "none", fill: "#334155" },
              pressed: { outline: "none" },
            }}
          />
        ))
      }
    </Geographies>
  );
});

export function GeoMap() {
  const [hoveredCluster, setHoveredCluster] = useState<ClusteredNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { data, isLoading } = trpc.network.geoNodes.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const clusters = useMemo(() => {
    if (!data || data.length === 0) return [];
    return clusterNodes(data, 12);
  }, [data]);

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

  const activeCount = data.filter((n) => n.isActive).length;
  const totalCount = data.length;
  const countryCount = new Set(data.map((n) => n.country)).size;

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
      <div className="relative w-full aspect-[2/1] bg-[#0f172a] rounded-lg overflow-hidden">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 120,
            center: [10, 30],
          }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* World map countries */}
          <MapGeographies />

          {/* Node clusters as markers */}
          {clusters.map((cluster, i) => {
            const activeInCluster = cluster.nodes.filter((n) => n.isActive).length;
            const allActive = activeInCluster === cluster.count;
            const radius = Math.min(25, 8 + Math.sqrt(cluster.count) * 4);

            return (
              <Marker
                key={`cluster-${i}`}
                coordinates={[cluster.lng, cluster.lat]}
                onMouseEnter={(e) => {
                  setHoveredCluster(cluster);
                  const rect = (e.target as SVGElement).getBoundingClientRect();
                  setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                }}
                onMouseLeave={() => setHoveredCluster(null)}
              >
                {/* Pulse animation for active clusters */}
                {allActive && (
                  <circle
                    r={radius}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={1.5}
                    opacity={0.5}
                  >
                    <animate
                      attributeName="r"
                      values={`${radius};${radius + 8};${radius}`}
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0;0.5"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* Main circle */}
                <circle
                  r={radius}
                  fill={allActive ? "#10B981" : "#64748b"}
                  stroke="#0f172a"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                />
                {/* Count label */}
                {cluster.count > 1 && (
                  <text
                    textAnchor="middle"
                    y={radius > 12 ? 5 : 4}
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      fill: "#fff",
                      fontSize: radius > 12 ? 12 : 10,
                      fontWeight: 600,
                      pointerEvents: "none",
                    }}
                  >
                    {cluster.count}
                  </text>
                )}
              </Marker>
            );
          })}
        </ComposableMap>

        {/* Hover tooltip */}
        {hoveredCluster && (
          <div
            className="fixed pointer-events-none bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 text-xs z-50"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 10,
              transform: "translate(-50%, -100%)",
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
                {hoveredCluster.nodes.map((node, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
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
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors">
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
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
