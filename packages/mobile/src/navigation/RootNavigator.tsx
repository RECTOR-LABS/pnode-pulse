/**
 * Root Navigator
 *
 * Main navigation structure for the app
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MainTabs } from "./MainTabs";
import { NodeDetailsScreen } from "@/screens";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#0a0a0b",
          },
          headerTintColor: "#fafafa",
          headerTitleStyle: {
            fontWeight: "600",
          },
          contentStyle: {
            backgroundColor: "#0a0a0b",
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NodeDetails"
          component={NodeDetailsScreen}
          options={{
            title: "Node Details",
            headerBackTitle: "Back",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
