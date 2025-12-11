/**
 * Node Card Component
 *
 * Displays a pNode summary in a list
 */

import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

interface NodeCardProps {
  node: {
    id?: string;
    address: string;
    pubkey?: string;
    version?: string;
    status?: string;
    cpuPercent?: number;
    uptime?: number;
    lastSeen?: string | number;
  };
  onPress: () => void;
}

export function NodeCard({ node, onPress }: NodeCardProps) {
  const isOnline = node.status === "online";

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-card rounded-xl p-4 border border-border active:bg-muted"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            className={`w-2.5 h-2.5 rounded-full mr-2 ${
              isOnline ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <Text className="text-foreground font-medium">
            {node.address.split(":")[0]}
          </Text>
        </View>
        <Text className="text-muted-foreground text-sm">
          v{node.version ?? "N/A"}
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <Text
          className="text-muted-foreground text-xs font-mono flex-1 mr-4"
          numberOfLines={1}
        >
          {node.pubkey ? `${node.pubkey.slice(0, 8)}...${node.pubkey.slice(-8)}` : "No pubkey"}
        </Text>

        <View className="flex-row items-center space-x-4">
          {node.cpuPercent !== undefined && (
            <View className="flex-row items-center">
              <Text className="text-muted-foreground text-xs mr-1">CPU</Text>
              <Text
                className={`text-xs font-medium ${
                  node.cpuPercent > 80
                    ? "text-red-500"
                    : node.cpuPercent > 50
                    ? "text-yellow-500"
                    : "text-green-500"
                }`}
              >
                {node.cpuPercent.toFixed(0)}%
              </Text>
            </View>
          )}

          {node.uptime !== undefined && (
            <View className="flex-row items-center">
              <Text className="text-muted-foreground text-xs mr-1">Up</Text>
              <Text className="text-foreground text-xs font-medium">
                {formatUptime(node.uptime)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days}d`;
  return `${hours}h`;
}
