"use client";

import { useMemo, useState, memo } from "react";
import Link from "next/link";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
} from "react-simple-maps";
import { trpc } from "@/lib/trpc";

// World map topology - using land for simpler rendering
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json";

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

interface GeoConnection {
  from: { country: string; lat: number; lng: number };
  to: { country: string; lat: number; lng: number };
  strength: number;
  normalizedStrength: number;
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

// Get version distribution for a cluster
function getVersionDistribution(nodes: GeoNode[]): Array<{ version: string; count: number; percentage: number }> {
  const versionMap = new Map<string, number>();
  nodes.forEach(n => {
    const v = n.version || "unknown";
    versionMap.set(v, (versionMap.get(v) || 0) + 1);
  });

  return Array.from(versionMap.entries())
    .map(([version, count]) => ({
      version,
      count,
      percentage: (count / nodes.length) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

// Get unique cities in a cluster
function getUniqueCities(nodes: GeoNode[]): string[] {
  return Array.from(new Set(nodes.map(n => n.city).filter(c => c && c !== "Unknown")));
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
            fill="#374151"
            stroke="#4b5563"
            strokeWidth={0.5}
            style={{
              default: { outline: "none" },
              hover: { outline: "none", fill: "#4b5563" },
              pressed: { outline: "none" },
            }}
          />
        ))
      }
    </Geographies>
  );
});

// Connection line with animated pulse
const ConnectionLine = memo(function ConnectionLine({
  connection,
  index
}: {
  connection: GeoConnection;
  index: number;
}) {
  const strokeWidth = 1 + connection.normalizedStrength * 2;

  return (
    <g>
      {/* Static line */}
      <Line
        from={[connection.from.lng, connection.from.lat]}
        to={[connection.to.lng, connection.to.lat]}
        stroke="#10B981"
        strokeWidth={strokeWidth}
        strokeOpacity={0.2}
        strokeLinecap="round"
      />
      {/* Animated pulse line */}
      <Line
        from={[connection.from.lng, connection.from.lat]}
        to={[connection.to.lng, connection.to.lat]}
        stroke="#10B981"
        strokeWidth={strokeWidth}
        strokeOpacity={0.6}
        strokeLinecap="round"
        strokeDasharray="4 8"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="12;0"
          dur={`${2 + index * 0.3}s`}
          repeatCount="indefinite"
        />
      </Line>
    </g>
  );
});

export function GeoMap() {
  const [hoveredCluster, setHoveredCluster] = useState<ClusteredNode | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ClusteredNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const { data, isLoading } = trpc.network.geoNodes.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const { data: connections } = trpc.network.geoConnections.useQuery(undefined, {
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
      <div
        className="relative w-full aspect-[2/1] bg-[#0f172a] rounded-lg overflow-hidden"
        onClick={() => setSelectedCluster(null)} // Click outside to close panel
      >
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

          {/* Connection lines between clusters */}
          {connections?.map((conn, i) => (
            <ConnectionLine key={`conn-${i}`} connection={conn} index={i} />
          ))}

          {/* Node clusters as markers */}
          {clusters.map((cluster, i) => {
            const activeInCluster = cluster.nodes.filter((n) => n.isActive).length;
            const allActive = activeInCluster === cluster.count;
            const isSelected = selectedCluster?.country === cluster.country &&
                               selectedCluster?.lat === cluster.lat;
            const radius = Math.min(25, 8 + Math.sqrt(cluster.count) * 4);

            return (
              <Marker
                key={`cluster-${i}`}
                coordinates={[cluster.lng, cluster.lat]}
                onMouseEnter={(e) => {
                  if (!selectedCluster) {
                    setHoveredCluster(cluster);
                    const rect = (e.target as SVGElement).getBoundingClientRect();
                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                  }
                }}
                onMouseLeave={() => setHoveredCluster(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCluster(isSelected ? null : cluster);
                  setHoveredCluster(null);
                }}
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
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    r={radius + 4}
                    fill="none"
                    stroke="#0066FF"
                    strokeWidth={2}
                  />
                )}
                {/* Main circle */}
                <circle
                  r={radius}
                  fill={allActive ? "#10B981" : "#64748b"}
                  stroke={isSelected ? "#0066FF" : "#0f172a"}
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                />
                {/* Count label */}
                {cluster.count >= 1 && (
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
        {hoveredCluster && !selectedCluster && (
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
              {hoveredCluster.count} node{hoveredCluster.count > 1 ? "s" : ""} • Click for details
            </div>
          </div>
        )}

        {/* Selected cluster detail panel */}
        {selectedCluster && (
          <div
            className="absolute top-4 right-4 w-64 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-xl z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-3 border-b border-border">
              <div>
                <div className="font-medium text-foreground flex items-center gap-2">
                  <span className="text-lg">{getCountryFlag(selectedCluster.country)}</span>
                  {selectedCluster.country}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {selectedCluster.count} node{selectedCluster.count > 1 ? "s" : ""} •{" "}
                  {selectedCluster.nodes.filter(n => n.isActive).length} active
                </div>
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Version breakdown */}
            <div className="p-3 border-b border-border">
              <div className="text-xs font-medium text-muted-foreground mb-2">Versions</div>
              <div className="space-y-1.5">
                {getVersionDistribution(selectedCluster.nodes).slice(0, 4).map(({ version, count, percentage }) => (
                  <div key={version} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      v{version.split('-')[0]} ({count})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cities */}
            {getUniqueCities(selectedCluster.nodes).length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="text-xs font-medium text-muted-foreground mb-1">Cities</div>
                <div className="text-xs text-foreground">
                  {getUniqueCities(selectedCluster.nodes).slice(0, 5).join(", ")}
                  {getUniqueCities(selectedCluster.nodes).length > 5 && (
                    <span className="text-muted-foreground"> +{getUniqueCities(selectedCluster.nodes).length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            {/* View all link */}
            <div className="p-3">
              <Link
                href={`/nodes?country=${selectedCluster.country}`}
                className="block text-center text-xs text-brand-500 hover:text-brand-600 transition-colors font-medium"
              >
                View All Nodes →
              </Link>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-background/80 backdrop-blur-sm border border-border">
            <div className="w-2 h-0.5 bg-emerald-500 opacity-60" />
            <span className="text-muted-foreground">Connections</span>
          </div>
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-background/80 backdrop-blur-sm border border-border">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Active nodes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple country code to flag emoji
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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
