"use client";

import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  variant?: "default" | "success" | "warning" | "danger";
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  const variantStyles = {
    default: "",
    success: "border-status-active/30",
    warning: "border-status-warning/30",
    danger: "border-status-inactive/30",
  };

  return (
    <div className={`card p-4 ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-1 text-sm">
          {trend && (
            <span
              className={
                trend.direction === "up"
                  ? "text-status-active"
                  : "text-status-inactive"
              }
            >
              {trend.direction === "up" ? "↑" : "↓"} {trend.value}%
            </span>
          )}
          {subtitle && (
            <span className="text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
