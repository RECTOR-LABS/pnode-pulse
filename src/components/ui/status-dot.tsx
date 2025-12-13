"use client";

type StatusType = "active" | "inactive" | "warning" | "neutral" | "loading";

interface StatusDotProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-3 h-3",
};

const statusColors = {
  active: "bg-status-active",
  inactive: "bg-status-inactive",
  warning: "bg-status-warning",
  neutral: "bg-muted-foreground",
  loading: "bg-muted-foreground",
};

export function StatusDot({
  status,
  size = "md",
  pulse = false,
  className = "",
}: StatusDotProps) {
  const shouldPulse = pulse || status === "active";

  return (
    <span
      className={`
        inline-block rounded-full
        ${sizeClasses[size]}
        ${statusColors[status]}
        ${shouldPulse ? "status-pulse" : ""}
        ${className}
      `}
      role="status"
      aria-label={`Status: ${status}`}
    />
  );
}

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const badgeLabels: Record<StatusType, string> = {
  active: "Active",
  inactive: "Inactive",
  warning: "Warning",
  neutral: "Unknown",
  loading: "Loading",
};

export function StatusBadge({
  status,
  label,
  size = "md",
  className = "",
}: StatusBadgeProps) {
  const displayLabel = label || badgeLabels[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        px-2 py-0.5 rounded-full text-xs font-medium
        ${status === "active" ? "bg-status-active-bg text-status-active" : ""}
        ${status === "inactive" ? "bg-status-inactive-bg text-status-inactive" : ""}
        ${status === "warning" ? "bg-status-warning-bg text-status-warning" : ""}
        ${status === "neutral" || status === "loading" ? "bg-muted text-muted-foreground" : ""}
        ${className}
      `}
    >
      <StatusDot status={status} size="sm" pulse={status === "active"} />
      {displayLabel}
    </span>
  );
}
