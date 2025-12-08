/**
 * Dashboard Screen
 *
 * Overview of pNode network statistics
 */

import React from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { StatCard } from "@/components/ui/StatCard";

export function DashboardScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch network stats
  const networkStats = useQuery({
    queryKey: ["network", "getStats"],
    queryFn: () => trpc.network.getStats.query(),
    refetchInterval: 30000, // Refresh every 30s
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["network", "getStats"] });
    setRefreshing(false);
  }, [queryClient]);

  const stats = networkStats.data;

  return (
    <SafeAreaView className="flex-1 bg-background">
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
          {/* Header */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
            <Text className="text-muted-foreground mt-1">
              pNode Network Overview
            </Text>
          </View>

          {/* Stats Grid */}
          <View className="flex-row flex-wrap -mx-2">
            <View className="w-1/2 px-2 mb-4">
              <StatCard
                title="Total Nodes"
                value={stats?.totalNodes ?? "--"}
                icon="server"
                trend={stats?.nodeTrend}
              />
            </View>
            <View className="w-1/2 px-2 mb-4">
              <StatCard
                title="Online Nodes"
                value={stats?.onlineNodes ?? "--"}
                icon="activity"
                variant="success"
              />
            </View>
            <View className="w-1/2 px-2 mb-4">
              <StatCard
                title="Network Uptime"
                value={
                  stats?.uptime
                    ? `${stats.uptime.toFixed(1)}%`
                    : "--"
                }
                icon="clock"
              />
            </View>
            <View className="w-1/2 px-2 mb-4">
              <StatCard
                title="Total Storage"
                value={stats?.totalStorage ?? "--"}
                icon="database"
              />
            </View>
          </View>

          {/* Network Health */}
          <View className="bg-card rounded-xl p-4 mb-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Network Health
            </Text>
            <View className="flex-row items-center">
              <View
                className={`w-3 h-3 rounded-full mr-2 ${
                  stats?.health === "healthy"
                    ? "bg-green-500"
                    : stats?.health === "degraded"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              />
              <Text className="text-foreground capitalize">
                {stats?.health ?? "Loading..."}
              </Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="bg-card rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Quick Stats
            </Text>
            <View className="space-y-3">
              <QuickStatRow
                label="Version Distribution"
                value={stats?.versions ?? "Loading..."}
              />
              <QuickStatRow
                label="Average Uptime"
                value={stats?.avgUptime ?? "Loading..."}
              />
              <QuickStatRow
                label="Last Update"
                value={
                  stats?.lastUpdate
                    ? new Date(stats.lastUpdate).toLocaleTimeString()
                    : "Loading..."
                }
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickStatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-2 border-b border-border last:border-b-0">
      <Text className="text-muted-foreground">{label}</Text>
      <Text className="text-foreground font-medium">{value}</Text>
    </View>
  );
}
