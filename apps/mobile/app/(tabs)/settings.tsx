import Constants from "expo-constants";
import { useRouter } from "expo-router";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Chip } from "@/components/chip";
import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontFamily, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useInstanceStore } from "@/stores/instance-store";
import { usePreferencesStore } from "@/stores/preferences-store";


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


export default function SettingsScreen() {
  const router = useRouter();
  const { instances, activeInstanceId, setActive, removeInstance } = useInstanceStore();

  const theme = usePreferencesStore((s) => s.theme);
  const refreshIntervalMs = usePreferencesStore((s) => s.refreshIntervalMs);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const setRefreshIntervalMs = usePreferencesStore((s) => s.setRefreshIntervalMs);

  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "border");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const secondaryText = useThemeColor({}, "textSecondary");

  const version = Constants.expoConfig?.version ?? "—";

  function confirmDelete(id: string, name: string) {
    Alert.alert("Remove Instance", `Remove "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeInstance(id) },
    ]);
  }

  function openExternal(url: string) {
    void Linking.openURL(url);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Settings"
          subtitle={`${instances.length} ${instances.length === 1 ? "instance" : "instances"}`}
        />
        {/* ── INSTANCES ──────────────────────────────────────── */}
        <SectionHeader label="INSTANCES" color={secondaryText} />
        <View style={styles.sectionBody}>
          {instances.map((item) => {
            const isActive = item.id === activeInstanceId;
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
                  <ThemedText
                    type="defaultSemiBold"
                    numberOfLines={1}
                    style={{ flex: 1, flexShrink: 1 }}
                  >
                    {item.name}
                  </ThemedText>
                  {isActive && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: tint + "22",
                          borderColor: tint + "55",
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: tint,
                          fontFamily: FontFamily.monoSemibold,
                          fontSize: 10,
                          letterSpacing: 1.2,
                        }}
                      >
                        ACTIVE
                      </ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText type="mono" numberOfLines={1}>
                  {item.baseUrl}
                </ThemedText>
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
              {THEME_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  active={opt.value === theme}
                  onPress={setTheme}
                  testID={`theme-${opt.value}`}
                />
              ))}
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
              {REFRESH_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  active={opt.value === refreshIntervalMs}
                  onPress={setRefreshIntervalMs}
                  testID={`refresh-${opt.value}`}
                />
              ))}
            </View>
          </View>
        </View>

        {/* ── TELEMETRY ──────────────────────────────────────── */}
        <SectionHeader label="TELEMETRY" color={secondaryText} />
        <View style={styles.sectionBody}>
          <TelemetryRow />
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

// ── Telemetry row ─────────────────────────────────────────────
// Surfaces whether the active instance has an OTLP endpoint configured so
// the user can confirm "sigpocket-mobile" should appear in their SigNoz.

function TelemetryRow() {
  const surface = useThemeColor({}, "surface");
  const border = useThemeColor({}, "borderSubtle");
  const secondaryText = useThemeColor({}, "textSecondary");
  const tint = useThemeColor({}, "tint");
  const active = useInstanceStore((s) => s.getActive());
  const otlpUrl = active?.otlpUrl;
  const baseUrl = active?.baseUrl;
  const ingestionKeySet = !!active?.ingestionKey;
  const enabled = !!otlpUrl;

  return (
    <View
      style={[
        styles.aboutGroup,
        { backgroundColor: surface, borderColor: border },
      ]}
    >
      <View style={styles.aboutRow}>
        <ThemedText>Status</ThemedText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Space.xs,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: enabled ? Brand.green400 : Brand.amber500,
            }}
          />
          <ThemedText
            style={{
              fontFamily: FontFamily.monoSemibold,
              fontSize: FontSize.sm,
              color: enabled ? Brand.green400 : Brand.amber500,
              letterSpacing: 0.4,
            }}
          >
            {enabled ? "ACTIVE" : "NOT CONFIGURED"}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.aboutDivider, { backgroundColor: border }]} />
      <View style={[styles.aboutRow, { gap: Space.md, alignItems: "flex-start" }]}>
        <ThemedText>OTLP endpoint</ThemedText>
        <ThemedText
          type="mono"
          numberOfLines={2}
          style={{ color: secondaryText, flex: 1, textAlign: "right" }}
        >
          {otlpUrl ?? "—"}
        </ThemedText>
      </View>
      <View style={[styles.aboutDivider, { backgroundColor: border }]} />
      <View style={styles.aboutRow}>
        <ThemedText>Ingestion key</ThemedText>
        <ThemedText type="mono" style={{ color: secondaryText }}>
          {ingestionKeySet ? "set" : "reusing API key"}
        </ThemedText>
      </View>
      <View style={[styles.aboutDivider, { backgroundColor: border }]} />
      <View style={styles.aboutRow}>
        <ThemedText>Service name</ThemedText>
        <ThemedText type="mono" style={{ color: secondaryText }}>
          sigpocket-mobile
        </ThemedText>
      </View>
      {!enabled && baseUrl ? (
        <>
          <View style={[styles.aboutDivider, { backgroundColor: border }]} />
          <View style={{ paddingHorizontal: Space.lg, paddingVertical: Space.md }}>
            <ThemedText
              type="caption"
              style={{ color: secondaryText, lineHeight: 18 }}
            >
              Add an OTLP endpoint on this instance to send the app&apos;s own
              telemetry. Uses the same API key. SigNoz Cloud:{" "}
              <ThemedText type="mono" style={{ color: tint }}>
                https://ingest.&lt;region&gt;.signoz.cloud:443
              </ThemedText>
              . Self-hosted: usually port 4318.
            </ThemedText>
          </View>
        </>
      ) : null}
    </View>
  );
}


function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <ThemedText style={[styles.sectionLabel, { color }]}>{label}</ThemedText>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 160,
    gap: Space.md,
  },
  sectionLabel: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: Space.md,
    marginBottom: Space.xs,
    paddingHorizontal: Space.lg,
  },
  sectionBody: {
    gap: Space.md,
    paddingHorizontal: Space.lg,
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
    gap: Space.sm,
  },
  badge: {
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  cardActions: {
    flexDirection: "row",
    gap: Space.xl,
    marginTop: Space.sm,
    paddingTop: Space.md,
    borderTopWidth: 1,
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
    paddingHorizontal: Space.lg,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
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
