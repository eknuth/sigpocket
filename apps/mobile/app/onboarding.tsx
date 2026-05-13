import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { randomId } from "@/lib/random-id";

import { InstanceForm } from "@/components/instance-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, Space } from "@/constants/theme";
import { useInstanceStore } from "@/stores/instance-store";

export default function OnboardingScreen() {
  const router = useRouter();
  const addInstance = useInstanceStore((s) => s.addInstance);

  async function handleSave(values: {
    name: string;
    baseUrl: string;
    apiKey: string;
    otlpUrl?: string;
    ingestionKey?: string;
  }) {
    await addInstance({
      id: randomId(),
      ...values,
    });
    router.replace("/(tabs)");
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <ThemedText type="title">SigPocket</ThemedText>
          <ThemedText style={styles.tagline}>
            Your SigNoz dashboard, in your pocket.
          </ThemedText>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <ThemedText type="subtitle">Connect your instance</ThemedText>
          <ThemedText type="caption">
            Enter the URL and API key for your SigNoz deployment. The connection will be validated
            before saving.
          </ThemedText>
        </View>

        <InstanceForm onSave={handleSave} submitLabel="Connect & Continue" />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: Space.xl,
    paddingTop: 96,
    gap: Space.xl,
  },
  hero: {
    gap: Space.sm,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    color: Brand.robin400,
  },
  divider: {
    height: 1,
    backgroundColor: "#2D3039",
    opacity: 0.5,
  },
  section: {
    gap: Space.sm,
  },
});
