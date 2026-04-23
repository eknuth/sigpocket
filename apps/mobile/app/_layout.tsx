import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { configureTelemetry } from "@sigpocket/telemetry";

import { Brand, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useNotificationDeepLink } from "@/hooks/use-notification-deep-link";
import {
  configureForegroundHandler,
  ensureAndroidChannels,
} from "@/lib/notifications";
import { useInstanceStore } from "@/stores/instance-store";
import { usePushStore } from "@/stores/push-store";

// Foreground handler + channel setup run once at module load — they're
// idempotent and have no side effects if the user hasn't granted permission.
configureForegroundHandler();
void ensureAndroidChannels();

const queryClient = new QueryClient();

const SigNozDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.robin400,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

const SigNozLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Brand.robin500,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { hydrated, instances } = useInstanceStore();
  const hydrate = useInstanceStore((s) => s.hydrate);
  const hydratePush = usePushStore((s) => s.hydrate);
  const getActive = useInstanceStore((s) => s.getActive);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);

  useEffect(() => {
    hydrate();
    void hydratePush();
  }, [hydrate, hydratePush]);

  // Route notification taps to the alerts deep-link screen. Guarded on
  // `hydrated` so the router is mounted before we try to push.
  useNotificationDeepLink(hydrated);

  // Sync telemetry with active instance
  useEffect(() => {
    const active = getActive();
    configureTelemetry(
      active
        ? { baseUrl: active.baseUrl, apiKey: active.apiKey, otlpUrl: active.otlpUrl }
        : null,
    );
  }, [activeInstanceId, getActive]);

  useEffect(() => {
    if (!hydrated) return;
    if (instances.length === 0) {
      router.replace("/onboarding");
    }
  }, [hydrated, instances.length, router]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.dark.background }}>
        <ActivityIndicator color={Brand.robin400} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? SigNozDark : SigNozLight}>
      <Stack
        screenOptions={{
          headerTintColor: colorScheme === "dark" ? Colors.dark.tint : Colors.light.tint,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="add-instance" options={{ title: "Add Instance", presentation: "modal" }} />
        <Stack.Screen name="edit-instance" options={{ title: "Edit Instance", presentation: "modal" }} />
        <Stack.Screen name="service/[name]" options={{ title: "Service" }} />
        <Stack.Screen name="traces/[service]" options={{ title: "Recent Traces" }} />
        <Stack.Screen name="trace/[id]" options={{ title: "Trace" }} />
        <Stack.Screen name="logs/[service]" options={{ title: "Recent Errors" }} />
        <Stack.Screen
          name="alerts/[instanceId]/[fingerprint]"
          options={{ title: "Alert" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNav />
    </QueryClientProvider>
  );
}
