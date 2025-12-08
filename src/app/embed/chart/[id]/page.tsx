"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

interface MetricPoint {
  time: string;
  cpuPercent: number;
  ramPercent: number;
  storageBytes: number;
  uptimeSeconds: number;
}

interface Props {
  params: Promise<{ id: string }>;
}

// Simple SVG line chart component
function LineChart({
  data,
  metric,
  theme,
  width = 400,
  height = 200,
}: {
  data: MetricPoint[];
  metric: "cpu" | "ram" | "storage" | "uptime";
  theme: "light" | "dark";
  width?: number;
  height?: number;
}) {
  const bgColor = theme === "dark" ? "#1f2937" : "#f9fafb";
  const lineColor = theme === "dark" ? "#60a5fa" : "#3b82f6";
  const gridColor = theme === "dark" ? "#374151" : "#e5e7eb";
  const textColor = theme === "dark" ? "#9ca3af" : "#6b7280";

  const values = useMemo(() => {
    return data.map((d) => {
      switch (metric) {
        case "cpu":
          return d.cpuPercent;
        case "ram":
          return d.ramPercent;
        case "storage":
          return d.storageBytes / (1024 * 1024 * 1024); // GB
        case "uptime":
          return d.uptimeSeconds / 3600; // Hours
        default:
          return 0;
      }
    });
  }, [data, metric]);

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = values.map((v, i) => {
    const x = padding.left + (i / (values.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((v - minVal) / range) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  const getUnit = () => {
    switch (metric) {
      case "cpu":
      case "ram":
        return "%";
      case "storage":
        return "GB";
      case "uptime":
        return "h";
    }
  };

  const formatValue = (v: number) => {
    if (metric === "storage") return v.toFixed(1);
    if (metric === "uptime") return v.toFixed(0);
    return v.toFixed(1);
  };

  // Y-axis labels
  const yLabels = [maxVal, (maxVal + minVal) / 2, minVal];

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Background */}
      <rect x={0} y={0} width={width} height={height} fill={bgColor} rx={8} />

      {/* Grid lines */}
      {yLabels.map((label, i) => {
        const y = padding.top + (i / 2) * chartHeight;
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke={gridColor}
              strokeDasharray="4,4"
            />
            <text
              x={padding.left - 5}
              y={y + 4}
              textAnchor="end"
              fill={textColor}
              fontSize={10}
            >
              {formatValue(label)}{getUnit()}
            </text>
          </g>
        );
      })}

      {/* Line chart */}
      {values.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* X-axis labels */}
      {data.length > 0 && (
        <>
          <text
            x={padding.left}
            y={height - 8}
            fill={textColor}
            fontSize={10}
          >
            {new Date(data[0].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </text>
          <text
            x={width - padding.right}
            y={height - 8}
            textAnchor="end"
            fill={textColor}
            fontSize={10}
          >
            {new Date(data[data.length - 1].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </text>
        </>
      )}
    </svg>
  );
}

export default function EmbedChartPage({ params }: Props) {
  const { id } = use(params);
  const searchParams = useSearchParams();

  const [data, setData] = useState<MetricPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get customization params
  const theme = (searchParams.get("theme") || "light") as "light" | "dark";
  const metric = (searchParams.get("metric") || "cpu") as "cpu" | "ram" | "storage" | "uptime";
  const range = searchParams.get("range") || "24h";
  const width = parseInt(searchParams.get("width") || "400");
  const height = parseInt(searchParams.get("height") || "200");

  const bgColor = theme === "dark" ? "bg-gray-900" : "bg-white";
  const textColor = theme === "dark" ? "text-white" : "text-gray-900";
  const mutedColor = theme === "dark" ? "text-gray-400" : "text-gray-500";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-200";

  const metricLabels = {
    cpu: "CPU Usage",
    ram: "RAM Usage",
    storage: "Storage",
    uptime: "Uptime",
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(
          `/api/v1/nodes/${id}/metrics?range=${range}&aggregation=hourly`
        );
        if (!response.ok) {
          if (response.status === 404) {
            setError("Node not found");
          } else {
            setError("Failed to load metrics");
          }
          return;
        }
        const result = await response.json();
        setData(result.data || []);
      } catch {
        setError("Failed to load metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [id, range]);

  if (loading) {
    return (
      <div
        className={`${bgColor} ${textColor} rounded-xl border ${borderColor} flex items-center justify-center`}
        style={{ width, height: height + 60 }}
      >
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${bgColor} ${textColor} rounded-xl border ${borderColor} flex items-center justify-center p-4`}
        style={{ width, height: height + 60 }}
      >
        <div className="text-center">
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  // Get current value
  const currentValue = data.length > 0 ? data[data.length - 1] : null;
  const getCurrentDisplay = () => {
    if (!currentValue) return "N/A";
    switch (metric) {
      case "cpu":
        return `${currentValue.cpuPercent.toFixed(1)}%`;
      case "ram":
        return `${currentValue.ramPercent.toFixed(1)}%`;
      case "storage":
        return `${(currentValue.storageBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      case "uptime":
        const hours = Math.floor(currentValue.uptimeSeconds / 3600);
        const days = Math.floor(hours / 24);
        return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
    }
  };

  return (
    <div
      className={`${bgColor} ${textColor} rounded-xl border ${borderColor} p-4`}
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className={`text-xs ${mutedColor}`}>{metricLabels[metric]}</div>
          <div className="text-xl font-semibold">{getCurrentDisplay()}</div>
        </div>
        <div className={`text-xs ${mutedColor}`}>
          Last {range}
        </div>
      </div>

      {/* Chart */}
      <LineChart
        data={data}
        metric={metric}
        theme={theme}
        width={width - 32}
        height={height}
      />

      {/* Footer */}
      <div className={`mt-2 flex items-center justify-between text-xs ${mutedColor}`}>
        <span>Node {id}</span>
        <a
          href={`https://pulse.rectorspace.com/nodes/${id}`}
          target="_blank"
          rel="noopener"
          className="hover:underline"
        >
          pNode Pulse
        </a>
      </div>
    </div>
  );
}
