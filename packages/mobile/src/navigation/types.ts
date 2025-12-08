/**
 * Navigation Types
 */

export type RootStackParamList = {
  MainTabs: undefined;
  NodeDetails: { nodeId: string };
};

export type MainTabParamList = {
  DashboardTab: undefined;
  NodesTab: undefined;
  SettingsTab: undefined;
};
