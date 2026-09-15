import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { LocalPreferenceProvider } from "./src/context/LocalPreferenceContext";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <LocalPreferenceProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="dark" />
        </AuthProvider>
      </LocalPreferenceProvider>
    </SafeAreaProvider>
  );
}
