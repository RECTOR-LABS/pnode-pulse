"use client";

interface VersionData {
  version: string;
  count: number;
}

interface VersionChartProps {
  data: VersionData[];
}

const COLORS = [
  "bg-brand-500",
  "bg-brand-400",
  "bg-brand-600",
  "bg-brand-300",
  "bg-brand-700",
];

export function VersionChart({ data }: VersionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const sortedData = [...data].sort((a, b) => b.count - a.count);

  if (data.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No version data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bar chart */}
      <div className="flex h-4 rounded-lg overflow-hidden bg-muted">
        {sortedData.map((item, index) => {
          const percentage = (item.count / total) * 100;
          return (
            <div
              key={item.version}
              className={`${COLORS[index % COLORS.length]} transition-all duration-300`}
              style={{ width: `${percentage}%` }}
              title={`${item.version}: ${item.count} nodes (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {sortedData.map((item, index) => {
          const percentage = ((item.count / total) * 100).toFixed(1);
          return (
            <div key={item.version} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${COLORS[index % COLORS.length]}`} />
              <span className="text-sm">
                <span className="font-medium">{item.version}</span>
                <span className="text-muted-foreground ml-1">({percentage}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
