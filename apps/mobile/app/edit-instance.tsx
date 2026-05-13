import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { InstanceForm } from "@/components/instance-form";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useInstanceStore } from "@/stores/instance-store";

export default function EditInstanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const instances = useInstanceStore((s) => s.instances);
  const updateInstance = useInstanceStore((s) => s.updateInstance);
  const instance = instances.find((i) => i.id === id);

  if (!instance) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={{ padding: Space.xl }}>Instance not found.</ThemedText>
      </ThemedView>
    );
  }

  async function handleSave(values: {
    name: string;
    baseUrl: string;
    apiKey: string;
    otlpUrl?: string;
    ingestionKey?: string;
  }) {
    await updateInstance(id, values);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <InstanceForm
          initial={{
            name: instance.name,
            baseUrl: instance.baseUrl,
            apiKey: instance.apiKey,
            otlpUrl: instance.otlpUrl,
            ingestionKey: instance.ingestionKey,
          }}
          onSave={handleSave}
          submitLabel="Save Changes"
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Space.xl, paddingTop: Space.xl },
});
