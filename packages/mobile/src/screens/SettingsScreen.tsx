/**
 * Settings Screen
 *
 * App settings and preferences
 */

import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { getBaseUrl } from "@/lib/trpc";

export function SettingsScreen() {
  const [notifications, setNotifications] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(true);

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const apiUrl = getBaseUrl();

  const handleOpenWebApp = () => {
    Linking.openURL("https://pulse.rectorspace.com");
  };

  const handleOpenGitHub = () => {
    Linking.openURL("https://github.com/RECTOR-LABS/pnode-pulse");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="p-4">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-foreground">Settings</Text>
            <Text className="text-muted-foreground mt-1">
              App preferences and information
            </Text>
          </View>

          {/* Preferences Section */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase mb-2 px-1">
              Preferences
            </Text>
            <View className="bg-card rounded-xl border border-border">
              <SettingRow
                label="Push Notifications"
                description="Get alerts for node status changes"
              >
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: "#3f3f46", true: "#0ea5e9" }}
                  thumbColor="#ffffff"
                />
              </SettingRow>

              <View className="h-px bg-border" />

              <SettingRow
                label="Dark Mode"
                description="Use dark theme"
              >
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  trackColor={{ false: "#3f3f46", true: "#0ea5e9" }}
                  thumbColor="#ffffff"
                />
              </SettingRow>
            </View>
          </View>

          {/* Links Section */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase mb-2 px-1">
              Links
            </Text>
            <View className="bg-card rounded-xl border border-border">
              <TouchableOpacity onPress={handleOpenWebApp}>
                <SettingRow
                  label="Open Web App"
                  description="pulse.rectorspace.com"
                  chevron
                />
              </TouchableOpacity>

              <View className="h-px bg-border" />

              <TouchableOpacity onPress={handleOpenGitHub}>
                <SettingRow
                  label="GitHub Repository"
                  description="View source code"
                  chevron
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* About Section */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase mb-2 px-1">
              About
            </Text>
            <View className="bg-card rounded-xl border border-border">
              <SettingRow
                label="Version"
                description={appVersion}
              />

              <View className="h-px bg-border" />

              <SettingRow
                label="API Server"
                description={apiUrl}
              />

              <View className="h-px bg-border" />

              <SettingRow
                label="Build"
                description={__DEV__ ? "Development" : "Production"}
              />
            </View>
          </View>

          {/* Credits */}
          <View className="items-center py-8">
            <Text className="text-brand-500 font-semibold text-lg">
              pNode Pulse
            </Text>
            <Text className="text-muted-foreground text-sm mt-1">
              by RECTOR Labs
            </Text>
            <Text className="text-muted-foreground text-xs mt-4">
              Real-time analytics for Xandeum pNode network
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  chevron?: boolean;
  children?: React.ReactNode;
}

function SettingRow({ label, description, chevron, children }: SettingRowProps) {
  return (
    <View className="flex-row items-center justify-between p-4">
      <View className="flex-1 mr-4">
        <Text className="text-foreground font-medium">{label}</Text>
        {description && (
          <Text className="text-muted-foreground text-sm mt-0.5">
            {description}
          </Text>
        )}
      </View>
      {children}
      {chevron && (
        <Text className="text-muted-foreground text-xl">›</Text>
      )}
    </View>
  );
}
