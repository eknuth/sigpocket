import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts as useGeist,
} from "@expo-google-fonts/geist";
import {
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
  useFonts as useGeistMono,
} from "@expo-google-fonts/geist-mono";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { configureTelemetry } from "@sigpocket/telemetry";

import { AtmosphericBg } from "@/components/atmospheric-bg";
import { Brand, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useInstanceStore } from "@/stores/instance-store";

const queryClient = new QueryClient();

const SigNozDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: "transparent",
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
    background: "transparent",
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
  const getActive = useInstanceStore((s) => s.getActive);
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId);

  const [geistLoaded] = useGeist({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  const [geistMonoLoaded] = useGeistMono({
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
  });
  const fontsLoaded = geistLoaded && geistMonoLoaded;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Sync telemetry with active instance
  useEffect(() => {
    const active = getActive();
    configureTelemetry(
      active
        ? {
            baseUrl: active.baseUrl,
            apiKey: active.apiKey,
            otlpUrl: active.otlpUrl,
            ingestionKey: active.ingestionKey,
          }
        : null,
    );
  }, [activeInstanceId, getActive]);

  useEffect(() => {
    if (!hydrated) return;
    if (instances.length === 0) {
      router.replace("/onboarding");
    }
  }, [hydrated, instances.length, router]);

  if (!hydrated || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.dark.background,
        }}
      >
        <AtmosphericBg />
        <ActivityIndicator color={Brand.robin400} size="large" />
      </View>
    );
  }

  const baseBg =
    colorScheme === "dark" ? Colors.dark.background : Colors.light.background;

  return (
    <ThemeProvider value={colorScheme === "dark" ? SigNozDark : SigNozLight}>
      <View style={{ flex: 1, backgroundColor: baseBg }}>
        <AtmosphericBg />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="add-instance" options={{ presentation: "modal" }} />
          <Stack.Screen name="edit-instance" options={{ presentation: "modal" }} />
          <Stack.Screen name="service/[name]" />
          <Stack.Screen name="traces/[service]" />
          <Stack.Screen name="trace/[id]" />
          <Stack.Screen name="logs/[service]" />
        </Stack>
        <StatusBar style="auto" />
      </View>
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
