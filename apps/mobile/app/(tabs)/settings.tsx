import { useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useInstanceStore } from "@/stores/instance-store";

export default function SettingsScreen() {
  const router = useRouter();
  const { instances, activeInstanceId, setActive, removeInstance } = useInstanceStore();
  const tint = useThemeColor({}, "tint");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "border");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  function confirmDelete(id: string, name: string) {
    Alert.alert("Remove Instance", `Remove "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeInstance(id) },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={instances}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedText type="caption" style={styles.sectionLabel}>
            INSTANCES
          </ThemedText>
        }
        renderItem={({ item }) => {
          const isActive = item.id === activeInstanceId;
          return (
            <Pressable
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
                    <ThemedText style={{ color: tint, fontSize: FontSize.xs, fontWeight: "600" }}>
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
                  onPress={() => router.push({ pathname: "/edit-instance", params: { id: item.id } })}
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
        }}
        ListFooterComponent={
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
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Space.lg,
    gap: Space.md,
  },
  sectionLabel: {
    marginBottom: Space.xs,
    letterSpacing: 1,
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
  addButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.lg,
    padding: Space.lg,
    alignItems: "center",
  },
});
