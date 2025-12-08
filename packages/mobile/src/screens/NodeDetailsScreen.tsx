/**
 * Node Details Screen
 *
 * Detailed view of a single pNode
 */

import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import type { RootStackParamList } from "@/navigation/types";

type NodeDetailsRouteProp = RouteProp<RootStackParamList, "NodeDetails">;

export function NodeDetailsScreen() {
  const route = useRoute<NodeDetailsRouteProp>();
  const { nodeId } = route.params;
  const [refreshing, setRefreshing] = React.useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch node details (types not shared yet between packages)
  const node = useQuery({
    queryKey: ["nodes", "getById", nodeId],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => (trpc as any).nodes.getById.query({ id: nodeId }),
    refetchInterval: 30000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["nodes", "getById", nodeId] });
    setRefreshing(false);
  }, [queryClient, nodeId]);

  if (node.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted-foreground">Loading node details...</Text>
      </SafeAreaView>
    );
  }

  const nodeData = node.data;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0ea5e9"
          />
        }
      >
        <View className="p-4">
          {/* Status Header */}
          <View className="bg-card rounded-xl p-4 mb-4 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  className={`w-3 h-3 rounded-full mr-2 ${
                    nodeData?.status === "online"
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />
                <Text className="text-lg font-semibold text-foreground capitalize">
                  {nodeData?.status ?? "Unknown"}
                </Text>
              </View>
              <Text className="text-muted-foreground text-sm">
                v{nodeData?.version ?? "N/A"}
              </Text>
            </View>

            {/* IP Address */}
            <View className="mb-2">
              <Text className="text-muted-foreground text-sm">IP Address</Text>
              <Text className="text-foreground font-mono">
                {nodeData?.address ?? "N/A"}
              </Text>
            </View>

            {/* Public Key */}
            <View>
              <Text className="text-muted-foreground text-sm">Public Key</Text>
              <Text className="text-foreground font-mono text-sm" numberOfLines={1}>
                {nodeData?.pubkey ?? "N/A"}
              </Text>
            </View>
          </View>

          {/* Performance Stats */}
          <View className="bg-card rounded-xl p-4 mb-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Performance
            </Text>

            <DetailRow label="CPU Usage" value={`${nodeData?.cpuPercent?.toFixed(1) ?? 0}%`} />
            <DetailRow
              label="RAM Usage"
              value={`${formatBytes(nodeData?.ramUsed ?? 0)} / ${formatBytes(nodeData?.ramTotal ?? 0)}`}
            />
            <DetailRow label="Storage" value={formatBytes(nodeData?.fileSize ?? 0)} />
            <DetailRow label="Uptime" value={formatUptime(nodeData?.uptime ?? 0)} />
          </View>

          {/* Network Stats */}
          <View className="bg-card rounded-xl p-4 mb-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Network
            </Text>

            <DetailRow label="Active Streams" value={nodeData?.activeStreams?.toString() ?? "0"} />
            <DetailRow label="Packets Received" value={nodeData?.packetsReceived?.toLocaleString() ?? "0"} />
            <DetailRow label="Packets Sent" value={nodeData?.packetsSent?.toLocaleString() ?? "0"} />
            <DetailRow label="Total Bytes" value={formatBytes(nodeData?.totalBytes ?? 0)} />
          </View>

          {/* Last Seen */}
          <View className="bg-card rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Activity
            </Text>

            <DetailRow
              label="Last Seen"
              value={
                nodeData?.lastSeen
                  ? new Date(nodeData.lastSeen).toLocaleString()
                  : "N/A"
              }
            />
            <DetailRow
              label="Last Updated"
              value={
                nodeData?.lastUpdated
                  ? new Date(nodeData.lastUpdated).toLocaleString()
                  : "N/A"
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border last:border-b-0">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className="text-foreground font-medium">{value}</Text>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
