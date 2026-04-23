import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const REGISTRATIONS_KEY = "sigpocket_push_registrations";

/**
 * One entry per (instance, device) pair. `secret` is the HMAC string the
 * relay returned on /register — opaque to us, required to unregister.
 *
 * The secret lives in SecureStore alongside API keys; it must never be
 * logged, exported, or sent in telemetry spans.
 */
export type PushRegistration = {
  instanceId: string;
  expoPushToken: string;
  secret: string;
  registeredAt: string; // ISO 8601
};

export type PushState = {
  registrations: Record<string, PushRegistration>; // keyed by instanceId
  hydrated: boolean;
};

export type PushActions = {
  hydrate: () => Promise<void>;
  setRegistration: (reg: PushRegistration) => Promise<void>;
  clearRegistration: (instanceId: string) => Promise<void>;
  getRegistration: (instanceId: string) => PushRegistration | undefined;
};

type PushStore = PushState & PushActions;

async function persist(regs: Record<string, PushRegistration>) {
  await SecureStore.setItemAsync(REGISTRATIONS_KEY, JSON.stringify(regs));
}

export const usePushStore = create<PushStore>((set, get) => ({
  registrations: {},
  hydrated: false,

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(REGISTRATIONS_KEY);
    let parsed: Record<string, PushRegistration> = {};
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object") {
          parsed = obj as Record<string, PushRegistration>;
        }
      } catch {
        // Corrupted blob — fall through to empty state.
      }
    }
    set({ registrations: parsed, hydrated: true });
  },

  setRegistration: async (reg) => {
    const next = { ...get().registrations, [reg.instanceId]: reg };
    set({ registrations: next });
    await persist(next);
  },

  clearRegistration: async (instanceId) => {
    const next = { ...get().registrations };
    delete next[instanceId];
    set({ registrations: next });
    await persist(next);
  },

  getRegistration: (instanceId) => get().registrations[instanceId],
}));
