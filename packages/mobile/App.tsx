/**
 * pNode Pulse Mobile App
 *
 * Real-time analytics for Xandeum pNode network
 */

import "./global.css";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TRPCProvider } from "@/lib/trpc";
import { RootNavigator } from "@/navigation";

export default function App() {
  return (
    <SafeAreaProvider>
      <TRPCProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </TRPCProvider>
    </SafeAreaProvider>
  );
}
