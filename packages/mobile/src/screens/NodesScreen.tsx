/**
 * Nodes Screen
 *
 * List of all pNodes in the network
 */

import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { NodeCard } from "@/components/ui/NodeCard";
import type { RootStackParamList } from "@/navigation/types";

type NodesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function NodesScreen() {
  const navigation = useNavigation<NodesScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">(
    "all"
  );
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch nodes (types not shared yet between packages)
  const nodes = useQuery({
    queryKey: ["nodes", "list", { search: searchQuery, status: statusFilter }],
    queryFn: () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (trpc as any).nodes.list.query({
        search: searchQuery || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
    refetchInterval: 30000,
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["nodes", "list"] });
    setRefreshing(false);
  }, [queryClient]);

  const handleNodePress = (nodeId: string) => {
    navigation.navigate("NodeDetails", { nodeId });
  };

  const filteredNodes = nodes.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground">Nodes</Text>
        <Text className="text-muted-foreground mt-1">
          {Array.isArray(filteredNodes) ? filteredNodes.length : 0} nodes found
        </Text>
      </View>

      {/* Search */}
      <View className="px-4 py-2">
        <View className="bg-card border border-border rounded-xl flex-row items-center px-4">
          <Text className="text-muted-foreground mr-2">Search</Text>
          <TextInput
            className="flex-1 py-3 text-foreground"
            placeholder="Search by IP, pubkey..."
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Status Filter */}
      <View className="px-4 py-2 flex-row space-x-2">
        <FilterChip
          label="All"
          active={statusFilter === "all"}
          onPress={() => setStatusFilter("all")}
        />
        <FilterChip
          label="Online"
          active={statusFilter === "online"}
          onPress={() => setStatusFilter("online")}
        />
        <FilterChip
          label="Offline"
          active={statusFilter === "offline"}
          onPress={() => setStatusFilter("offline")}
        />
      </View>

      {/* Node List */}
      <FlatList
        className="flex-1 px-4"
        data={Array.isArray(filteredNodes) ? filteredNodes : []}
        keyExtractor={(item) => item.id || item.address}
        renderItem={({ item }) => (
          <NodeCard
            node={item}
            onPress={() => handleNodePress(item.id || item.address)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0ea5e9"
          />
        }
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Text className="text-muted-foreground">
              {nodes.isLoading ? "Loading nodes..." : "No nodes found"}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`px-4 py-2 rounded-full ${
        active ? "bg-brand-500" : "bg-card border border-border"
      }`}
    >
      <Text className={active ? "text-white font-medium" : "text-foreground"}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
