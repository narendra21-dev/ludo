import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { NetProvider } from "../lib/net";

export default function RootLayout() {
  return (
    <NetProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0f172a" },
        }}
      />
    </NetProvider>
  );
}
