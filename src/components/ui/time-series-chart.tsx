"use client";

interface DataPoint {
  time: Date | string;
  value: number;
}

interface TimeSeriesChartProps {
  data: DataPoint[];
  label: string;
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
  formatTime?: (time: Date) => string;
}

export function TimeSeriesChart({
  data,
  label,
  color = "stroke-brand-500",
  height = 200,
  formatValue = (v) => v.toFixed(1),
}: TimeSeriesChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = 100; // percentage
  const chartHeight = height - padding.top - padding.bottom;

  // Generate path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = chartHeight - ((d.value - minValue) / range) * chartHeight;
    return `${x},${y + padding.top}`;
  });

  const linePath = `M ${points.join(" L ")}`;

  // Area path (for fill)
  const areaPath = `${linePath} L 100,${chartHeight + padding.top} L 0,${chartHeight + padding.top} Z`;

  // Y-axis labels
  const yLabels = [minValue, (minValue + maxValue) / 2, maxValue].reverse();

  return (
    <div className="relative" style={{ height }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-muted-foreground py-5">
        {yLabels.map((v, i) => (
          <span key={i}>{formatValue(v)}</span>
        ))}
      </div>

      {/* Chart area */}
      <div className="ml-12 h-full">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                className="stroke-muted"
                strokeWidth="0.2"
              />
            );
          })}

          {/* Area fill */}
          <path
            d={areaPath}
            className="fill-brand-500/10"
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            className={color}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 text-center text-xs text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

interface RangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

export function RangeSelector({ value, onChange, options }: RangeSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
