import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SigNozClient } from "@sigpocket/signoz-client";
import { traceAsync } from "@sigpocket/telemetry";

import { ThemedText } from "@/components/themed-text";
import { Brand, FontSize, Radius, Space } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type Props = {
  initial?: { name: string; baseUrl: string; apiKey: string };
  onSave: (values: { name: string; baseUrl: string; apiKey: string }) => void;
  submitLabel?: string;
};

type ConnectionStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "ok"; serviceCount: number }
  | { state: "error"; message: string };

export function InstanceForm({ initial, onSave, submitLabel = "Save" }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? "");
  const [status, setStatus] = useState<ConnectionStatus>({ state: "idle" });

  const tint = useThemeColor({}, "tint");
  const textColor = useThemeColor({}, "text");
  const secondaryText = useThemeColor({}, "textSecondary");
  const surface = useThemeColor({}, "surfaceRaised");
  const border = useThemeColor({}, "border");
  const successColor = useThemeColor({}, "success");
  const errorColor = useThemeColor({}, "error");

  const normalizedUrl = baseUrl.replace(/\/+$/, "");
  const canTest = normalizedUrl.length > 0 && apiKey.length > 0;
  const canSave = canTest && status.state === "ok";

  async function testConnection() {
    setStatus({ state: "testing" });
    const client = new SigNozClient({ baseUrl: normalizedUrl, apiKey });
    const result = await traceAsync("instance.test_connection", async (span) => {
      span.setAttribute("instance.url", normalizedUrl);
      const r = await client.testConnection();
      if (r.ok) {
        span.setAttribute("instance.service_count", r.serviceCount ?? 0);
      }
      return r;
    });
    if (result.ok) {
      setStatus({ state: "ok", serviceCount: result.serviceCount ?? 0 });
    } else {
      setStatus({ state: "error", message: friendlyError(result.error ?? "Unknown error") });
    }
  }

  function handleSave() {
    onSave({ name: name.trim() || normalizedUrl, baseUrl: normalizedUrl, apiKey });
  }

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="caption">FRIENDLY NAME (OPTIONAL)</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: border, backgroundColor: surface }]}
          placeholder="e.g. Production"
          placeholderTextColor={secondaryText}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          testID="instance-name-input"
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="caption">SIGNOZ URL</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: border, backgroundColor: surface }]}
          placeholder="https://signoz.example.com"
          placeholderTextColor={secondaryText}
          value={baseUrl}
          onChangeText={(t) => {
            setBaseUrl(t);
            if (status.state !== "idle") setStatus({ state: "idle" });
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="instance-url-input"
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="caption">API KEY</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: border, backgroundColor: surface }]}
          placeholder="your-signoz-api-key"
          placeholderTextColor={secondaryText}
          value={apiKey}
          onChangeText={(t) => {
            setApiKey(t);
            if (status.state !== "idle") setStatus({ state: "idle" });
          }}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="instance-apikey-input"
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: canTest ? tint : border, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={testConnection}
        disabled={!canTest || status.state === "testing"}
        testID="test-connection-button"
      >
        {status.state === "testing" ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <ThemedText style={styles.buttonText}>Test Connection</ThemedText>
        )}
      </Pressable>

      {status.state === "ok" && (
        <View style={[styles.statusBanner, { backgroundColor: successColor + "18", borderColor: successColor + "44" }]} testID="connection-success">
          <ThemedText style={{ color: successColor, fontSize: FontSize.sm }}>
            Connected — {status.serviceCount} service{status.serviceCount !== 1 ? "s" : ""} found
          </ThemedText>
        </View>
      )}

      {status.state === "error" && (
        <View style={[styles.statusBanner, { backgroundColor: errorColor + "18", borderColor: errorColor + "44" }]} testID="connection-error">
          <ThemedText style={{ color: errorColor, fontSize: FontSize.sm }}>{status.message}</ThemedText>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.saveButton,
          { backgroundColor: canSave ? Brand.green500 : border, opacity: pressed && canSave ? 0.85 : 1 },
        ]}
        onPress={handleSave}
        disabled={!canSave}
        testID="save-instance-button"
      >
        <ThemedText style={styles.buttonText}>{submitLabel}</ThemedText>
      </Pressable>
    </View>
  );
}

function friendlyError(raw: string): string {
  if (raw.includes("Network request failed") || raw.includes("Failed to fetch")) {
    return "Cannot reach server — check the URL and your network connection.";
  }
  if (raw.includes("401") || raw.includes("403")) {
    return "Authentication failed — check your API key.";
  }
  if (raw.includes("404")) {
    return "Endpoint not found — is this a SigNoz instance?";
  }
  if (raw.includes("5")) {
    const match = raw.match(/SigNoz (\d+)/);
    if (match && Number(match[1]) >= 500) {
      return `Server error (${match[1]}) — the SigNoz instance may be having issues.`;
    }
  }
  if (raw.includes("certificate") || raw.includes("SSL") || raw.includes("TLS")) {
    return "Certificate error — the server's TLS certificate could not be verified.";
  }
  if (raw.includes("timeout") || raw.includes("Timeout")) {
    return "Request timed out — the server may be slow or unreachable.";
  }
  return raw;
}

const styles = StyleSheet.create({
  form: {
    gap: Space.lg,
  },
  field: {
    gap: Space.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    fontSize: FontSize.base,
    minHeight: 48,
  },
  button: {
    paddingVertical: Space.md,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  saveButton: {
    marginTop: Space.sm,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: FontSize.base,
  },
  statusBanner: {
    padding: Space.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
});
