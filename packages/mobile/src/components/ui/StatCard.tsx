/**
 * Stat Card Component
 *
 * Displays a single statistic with icon and trend
 */

import React from "react";
import { View, Text } from "react-native";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string;
  trend?: number;
  variant?: "default" | "success" | "warning" | "error";
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  variant = "default",
}: StatCardProps) {
  const getIconColor = () => {
    switch (variant) {
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-brand-500";
    }
  };

  const getTrendColor = () => {
    if (!trend) return "";
    return trend > 0 ? "text-green-500" : "text-red-500";
  };

  return (
    <View className="bg-card rounded-xl p-4 border border-border">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-muted-foreground text-sm">{title}</Text>
        {icon && (
          <View className={`w-8 h-8 rounded-lg bg-muted items-center justify-center`}>
            <Text className={getIconColor()}>{getIconEmoji(icon)}</Text>
          </View>
        )}
      </View>
      <View className="flex-row items-end">
        <Text className="text-2xl font-bold text-foreground">{value}</Text>
        {trend !== undefined && (
          <Text className={`ml-2 text-sm ${getTrendColor()}`}>
            {trend > 0 ? "+" : ""}{trend}%
          </Text>
        )}
      </View>
    </View>
  );
}

function getIconEmoji(icon: string): string {
  const icons: Record<string, string> = {
    server: "S",
    activity: "A",
    clock: "T",
    database: "D",
    cpu: "C",
    memory: "M",
  };
  return icons[icon] || "";
}
