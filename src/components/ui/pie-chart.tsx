"use client";

interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  donut?: boolean;
  showLabels?: boolean;
}

const DEFAULT_COLORS = [
  "#8b5cf6", // violet-500
  "#3b82f6", // blue-500
  "#06b6d4", // cyan-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
];

export function PieChart({ data, size = 200, donut = true, showLabels = true }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No data available
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = donut ? radius * 0.6 : 0;
  const center = radius;

  // Calculate pie segments
  let startAngle = -90; // Start from top
  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (percentage / 100) * 360;
    const endAngle = startAngle + angle;

    const segment = {
      ...item,
      percentage,
      startAngle,
      endAngle,
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    };

    startAngle = endAngle;
    return segment;
  });

  // Generate SVG path for each segment
  const getPath = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const x1Inner = center + innerRadius * Math.cos(startRad);
    const y1Inner = center + innerRadius * Math.sin(startRad);
    const x2Inner = center + innerRadius * Math.cos(endRad);
    const y2Inner = center + innerRadius * Math.sin(endRad);

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    if (donut) {
      return `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
        L ${x2Inner} ${y2Inner}
        A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}
        Z
      `;
    }

    return `
      M ${center} ${center}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      Z
    `;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG Pie Chart */}
      <svg width={size} height={size} className="transform -rotate-90">
        {segments.map((segment, index) => (
          <path
            key={segment.label}
            d={getPath(segment.startAngle + 90, segment.endAngle + 90)}
            fill={segment.color}
            className="transition-opacity hover:opacity-80 cursor-pointer"
          >
            <title>{`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}</title>
          </path>
        ))}
      </svg>

      {/* Legend */}
      {showLabels && (
        <div className="flex flex-wrap justify-center gap-3">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm">
                <span className="font-medium">{segment.label}</span>
                <span className="text-muted-foreground ml-1">
                  ({segment.percentage.toFixed(1)}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
