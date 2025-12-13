"use client";

import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  status?: "active" | "inactive" | "warning" | "neutral";
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status,
}: StatCardProps) {
  const statusBadge = status && (
    <span className={`status-badge status-badge-${status} flex items-center gap-1.5`}>
      <span
        className={`w-2 h-2 rounded-full ${
          status === "active"
            ? "bg-status-active status-pulse"
            : status === "inactive"
            ? "bg-status-inactive"
            : status === "warning"
            ? "bg-status-warning"
            : "bg-muted-foreground"
        }`}
      />
      {status === "active" ? "Online" : status === "inactive" ? "Offline" : status === "warning" ? "Degraded" : "Loading"}
    </span>
  );

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-muted-foreground text-sm">{title}</span>
        </div>
        {statusBadge}
      </div>

      <div className="text-3xl font-bold tracking-tight">
        {value}
      </div>

      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-2 text-sm">
          {trend && (
            <span className={trend.value >= 0 ? "text-status-active" : "text-status-inactive"}>
              {trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}
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
