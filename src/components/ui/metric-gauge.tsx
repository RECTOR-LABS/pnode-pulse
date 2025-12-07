"use client";

interface MetricGaugeProps {
  value: number;
  maxValue?: number;
  label: string;
  size?: "sm" | "md" | "lg";
  color?: "default" | "warning" | "danger";
}

const sizeConfig = {
  sm: { width: 80, stroke: 6, fontSize: "text-lg" },
  md: { width: 120, stroke: 8, fontSize: "text-2xl" },
  lg: { width: 160, stroke: 10, fontSize: "text-3xl" },
};

export function MetricGauge({
  value,
  maxValue = 100,
  label,
  size = "md",
  color = "default",
}: MetricGaugeProps) {
  const { width, stroke, fontSize } = sizeConfig[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / maxValue) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  // Determine color based on value or prop
  const getColor = () => {
    if (color === "warning" || (color === "default" && percentage > 70)) {
      return "stroke-status-warning";
    }
    if (color === "danger" || (color === "default" && percentage > 90)) {
      return "stroke-status-inactive";
    }
    return "stroke-brand-500";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: width }}>
        <svg className="transform -rotate-90" width={width} height={width}>
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            className={`transition-all duration-500 ${getColor()}`}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${fontSize}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground mt-2">{label}</span>
    </div>
  );
}
