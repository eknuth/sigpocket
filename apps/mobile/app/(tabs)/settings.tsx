import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  disablePushForInstance,
  enablePushForInstance,
} from "@/lib/push-registration";
import { resolveRelayUrl } from "@/lib/push-relay";
import { useInstanceStore } from "@/stores/instance-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { usePushStore } from "@/stores/push-store";

// ── Preference options ────────────────────────────────────────

type ThemePref = "system" | "light" | "dark";
type RefreshIntervalMs = 5000 | 15000 | 30000 | 60000;

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const REFRESH_OPTIONS: { value: RefreshIntervalMs; label: string }[] = [
  { value: 5000, label: "5s" },
  { value: 15000, label: "15s" },
  { value: 30000, label: "30s" },
  { value: 60000, label: "60s" },
];

const GITHUB_URL = "https://github.com/eknuth/sigpocket";
const LICENSE_URL = "https://github.com/eknuth/sigpocket/blob/main/LICENSE";

// ── Screen ────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const { instances, activeInstanceId, setActive, removeInstance } = useInstanceStore();

  const theme = usePreferencesStore((s) => s.theme);
  const refreshIntervalMs = usePreferencesStore((s) => s.refreshIntervalMs);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const setRefreshIntervalMs = usePreferencesStore((s) => s.setRefreshIntervalMs);

  const pushRegistrations = usePushStore((s) => s.registrations);
  const [pushBusyId, setPushBusyId] = useState<string | null>(null);

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "border");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const secondaryText = useThemeColor({}, "textSecondary");

  const version = Constants.expoConfig?.version ?? "—";

  function confirmDelete(id: string, name: string) {
    Alert.alert("Remove Instance", `Remove "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const instance = instances.find((i) => i.id === id);
          if (instance) {
            // Best-effort unregister; don't block deletion on network failure.
            void disablePushForInstance(instance);
          }
          await removeInstance(id);
        },
      },
    ]);
  }

  async function togglePush(instanceId: string, enable: boolean) {
    const instance = instances.find((i) => i.id === instanceId);
    if (!instance) return;
    setPushBusyId(instanceId);
    try {
      if (enable) {
        const result = await enablePushForInstance(instance);
        if (!result.ok) {
          Alert.alert("Push notifications", result.error);
        }
      } else {
        await disablePushForInstance(instance);
      }
    } finally {
      setPushBusyId(null);
    }
  }

  function openExternal(url: string) {
    void Linking.openURL(url);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ── INSTANCES ──────────────────────────────────────── */}
        <SectionHeader label="INSTANCES" color={secondaryText} />
        <View style={styles.sectionBody}>
          {instances.map((item) => {
            const isActive = item.id === activeInstanceId;
            const registration = pushRegistrations[item.id];
            const relayConfigured = resolveRelayUrl(item.pushRelayUrl) !== null;
            const pushEnabled = Boolean(registration);
            const busy = pushBusyId === item.id;
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: surface,
                    borderColor: isActive ? tint : borderSubtle,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => setActive(item.id)}
                testID={`instance-card-${item.id}`}
              >
                <View style={styles.cardHeader}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  {isActive && (
                    <View style={[styles.badge, { backgroundColor: tint + "22" }]}>
                      <ThemedText
                        style={{ color: tint, fontSize: FontSize.xs, fontWeight: "600" }}
                      >
                        ACTIVE
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="mono" numberOfLines={1}>
                  {item.baseUrl}
                </ThemedText>

                <View style={[styles.pushRow, { borderTopColor: borderSubtle }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: FontSize.sm }}>
                      Push notifications
                    </ThemedText>
                    <ThemedText
                      style={{ color: secondaryText, fontSize: FontSize.xs }}
                      testID={`push-status-${item.id}`}
                    >
                      {!relayConfigured
                        ? "No relay configured"
                        : pushEnabled && registration
                          ? `Registered ${formatRelativeTime(registration.registeredAt)}`
                          : "Disabled"}
                    </ThemedText>
                  </View>
                  {busy ? (
                    <ActivityIndicator color={tint} />
                  ) : (
                    <Switch
                      value={pushEnabled}
                      onValueChange={(v) => togglePush(item.id, v)}
                      disabled={!relayConfigured && !pushEnabled}
                      testID={`push-toggle-${item.id}`}
                    />
                  )}
                </View>

                <View style={[styles.cardActions, { borderTopColor: borderSubtle }]}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/edit-instance", params: { id: item.id } })
                    }
                    hitSlop={8}
                    testID={`edit-instance-${item.id}`}
                  >
                    <ThemedText style={{ color: tint, fontSize: FontSize.sm }}>Edit</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDelete(item.id, item.name)}
                    hitSlop={8}
                    testID={`delete-instance-${item.id}`}
                  >
                    <ThemedText style={{ color: Brand.red400, fontSize: FontSize.sm }}>
                      Remove
                    </ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              { borderColor: border, opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => router.push("/add-instance")}
            testID="add-instance-button"
          >
            <ThemedText style={{ color: tint, fontWeight: "600" }}>+ Add Instance</ThemedText>
          </Pressable>
        </View>

        {/* ── PREFERENCES ────────────────────────────────────── */}
        <SectionHeader label="PREFERENCES" color={secondaryText} />
        <View style={styles.sectionBody}>
          <View
            style={[
              styles.prefCard,
              { backgroundColor: surface, borderColor: borderSubtle },
            ]}
          >
            <ThemedText type="defaultSemiBold">Theme</ThemedText>
            <View style={styles.chipRow}>
              {THEME_OPTIONS.map((opt) => {
                const active = opt.value === theme;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setTheme(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tint + "22" : "transparent",
                        borderColor: active ? tint : borderSubtle,
                      },
                    ]}
                    testID={`theme-${opt.value}`}
                  >
                    <ThemedText
                      style={{
                        fontSize: FontSize.xs,
                        fontWeight: active ? "600" : "400",
                        color: active ? tint : undefined,
                      }}
                    >
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            style={[
              styles.prefCard,
              { backgroundColor: surface, borderColor: borderSubtle },
            ]}
          >
            <ThemedText type="defaultSemiBold">Services refresh interval</ThemedText>
            <View style={styles.chipRow}>
              {REFRESH_OPTIONS.map((opt) => {
                const active = opt.value === refreshIntervalMs;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setRefreshIntervalMs(opt.value)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? tint + "22" : "transparent",
                        borderColor: active ? tint : borderSubtle,
                      },
                    ]}
                    testID={`refresh-${opt.value}`}
                  >
                    <ThemedText
                      style={{
                        fontSize: FontSize.xs,
                        fontWeight: active ? "600" : "400",
                        color: active ? tint : undefined,
                      }}
                    >
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── ABOUT ──────────────────────────────────────────── */}
        <SectionHeader label="ABOUT" color={secondaryText} />
        <View style={styles.sectionBody}>
          <View
            style={[
              styles.aboutGroup,
              { backgroundColor: surface, borderColor: borderSubtle },
            ]}
          >
            <View style={styles.aboutRow}>
              <ThemedText>Version</ThemedText>
              <ThemedText type="mono" style={{ color: secondaryText }}>
                {version}
              </ThemedText>
            </View>

            <View style={[styles.aboutDivider, { backgroundColor: borderSubtle }]} />

            <Pressable
              onPress={() => openExternal(GITHUB_URL)}
              style={({ pressed }) => [styles.aboutRow, { opacity: pressed ? 0.6 : 1 }]}
              testID="about-github"
            >
              <ThemedText>GitHub</ThemedText>
              <ThemedText style={{ color: tint, fontSize: FontSize.sm }}>Open</ThemedText>
            </Pressable>

            <View style={[styles.aboutDivider, { backgroundColor: borderSubtle }]} />

            <Pressable
              onPress={() => openExternal(LICENSE_URL)}
              style={({ pressed }) => [styles.aboutRow, { opacity: pressed ? 0.6 : 1 }]}
              testID="about-license"
            >
              <ThemedText>License</ThemedText>
              <ThemedText style={{ color: secondaryText, fontSize: FontSize.sm }}>
                Apache-2.0
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Section header ────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <ThemedText style={[styles.sectionLabel, { color }]}>{label}</ThemedText>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: Space.lg,
    gap: Space.md,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: Space.md,
    marginBottom: Space.xs,
    paddingHorizontal: Space.xs,
  },
  sectionBody: {
    gap: Space.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  cardActions: {
    flexDirection: "row",
    gap: Space.xl,
    marginTop: Space.sm,
    paddingTop: Space.md,
    borderTopWidth: 1,
  },
  pushRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    marginTop: Space.sm,
    paddingTop: Space.md,
    borderTopWidth: 1,
    minHeight: 40,
  },
  addButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.lg,
    padding: Space.lg,
    alignItems: "center",
  },
  prefCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Space.lg,
    gap: Space.md,
  },
  chipRow: {
    flexDirection: "row",
    gap: Space.sm,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  aboutGroup: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
  },
  aboutDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Space.lg,
  },
});
