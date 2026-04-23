import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useInstanceStore } from "@/stores/instance-store";

/**
 * Deep-link target for `sigpocket://alerts/:instanceId/:fingerprint`.
 *
 * v1 behavior (per ticket EDW-487): switch the active instance to the one
 * the alert came from, show the fingerprint, and offer a jump-off to the
 * Services tab. Wiring up a true fingerprint→log-row scroll is deferred
 * until we have a Recent Errors list that lives at the instance level
 * (right now Recent Errors is keyed per service).
 */
export default function AlertDetailScreen() {
  const { instanceId, fingerprint } = useLocalSearchParams<{
    instanceId: string;
    fingerprint: string;
  }>();
  const router = useRouter();

  const instances = useInstanceStore((s) => s.instances);
  const activeId = useInstanceStore((s) => s.activeInstanceId);
  const setActive = useInstanceStore((s) => s.setActive);

  const instance = instances.find((i) => i.id === instanceId);

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "borderSubtle");
  const secondaryText = useThemeColor({}, "textSecondary");

  // If the alert's instance is known and not currently active, switch to it.
  useEffect(() => {
    if (instance && instance.id !== activeId) {
      void setActive(instance.id);
    }
  }, [instance, activeId, setActive]);

  if (!instance) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Alert</ThemedText>
          <ThemedText style={{ color: secondaryText }}>
            This alert came from an instance that is no longer configured on
            this device. You may have removed it, or the push arrived after a
            fresh reinstall.
          </ThemedText>
          <ThemedText type="caption" style={{ color: secondaryText, marginTop: Space.md }}>
            INSTANCE ID
          </ThemedText>
          <ThemedText type="mono" selectable>
            {instanceId}
          </ThemedText>
          <ThemedText type="caption" style={{ color: secondaryText, marginTop: Space.md }}>
            FINGERPRINT
          </ThemedText>
          <ThemedText type="mono" selectable>
            {fingerprint}
          </ThemedText>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="subtitle">Alert</ThemedText>
        <ThemedText style={{ color: secondaryText }}>
          From <ThemedText type="defaultSemiBold">{instance.name}</ThemedText>
        </ThemedText>

        <View
          style={[
            styles.card,
            { backgroundColor: surface, borderColor: border },
          ]}
          testID="alert-detail-card"
        >
          <ThemedText type="caption" style={{ color: secondaryText }}>
            FINGERPRINT
          </ThemedText>
          <ThemedText type="mono" selectable>
            {fingerprint}
          </ThemedText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: tint, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.replace("/(tabs)")}
          testID="alert-view-services"
        >
          <ThemedText style={styles.buttonText}>View Services</ThemedText>
        </Pressable>

        <ThemedText
          type="caption"
          style={{ color: secondaryText, marginTop: Space.md }}
        >
          Full alert context is in SigNoz — the push payload carries the
          fingerprint only.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Space.xl, gap: Space.md },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Space.lg,
    gap: Space.xs,
  },
  button: {
    paddingVertical: Space.md,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    marginTop: Space.md,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: FontSize.base,
  },
});
