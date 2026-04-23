import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { randomId } from "@/lib/random-id";

import { InstanceForm } from "@/components/instance-form";
import { ThemedView } from "@/components/themed-view";
import { Space } from "@/constants/theme";
import { useInstanceStore } from "@/stores/instance-store";

export default function AddInstanceScreen() {
  const router = useRouter();
  const addInstance = useInstanceStore((s) => s.addInstance);

  async function handleSave(values: {
    name: string;
    baseUrl: string;
    apiKey: string;
    otlpUrl?: string;
    pushRelayUrl?: string;
  }) {
    await addInstance({ id: randomId(), ...values });
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <InstanceForm onSave={handleSave} submitLabel="Add Instance" />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Space.xl, paddingTop: Space.xl },
});
