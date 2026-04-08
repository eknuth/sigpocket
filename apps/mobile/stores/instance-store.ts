import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { SigNozInstance } from "@sigpocket/shared-types";

const STORAGE_KEY = "sigpocket_instances";
const ACTIVE_KEY = "sigpocket_active_instance";

export type InstanceState = {
  instances: SigNozInstance[];
  activeInstanceId: string | null;
  hydrated: boolean;
};

export type InstanceActions = {
  hydrate: () => Promise<void>;
  addInstance: (instance: SigNozInstance) => Promise<void>;
  updateInstance: (id: string, patch: Partial<Omit<SigNozInstance, "id">>) => Promise<void>;
  removeInstance: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  getActive: () => SigNozInstance | null;
};

type InstanceStore = InstanceState & InstanceActions;

async function persist(instances: SigNozInstance[], activeId: string | null) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(instances));
  if (activeId) {
    await SecureStore.setItemAsync(ACTIVE_KEY, activeId);
  } else {
    await SecureStore.deleteItemAsync(ACTIVE_KEY);
  }
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
  instances: [],
  activeInstanceId: null,
  hydrated: false,

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    const activeId = await SecureStore.getItemAsync(ACTIVE_KEY);
    const instances: SigNozInstance[] = raw ? JSON.parse(raw) : [];
    set({
      instances,
      activeInstanceId: activeId ?? instances[0]?.id ?? null,
      hydrated: true,
    });
  },

  addInstance: async (instance) => {
    const { instances, activeInstanceId } = get();
    const next = [...instances, instance];
    const nextActive = activeInstanceId ?? instance.id;
    set({ instances: next, activeInstanceId: nextActive });
    await persist(next, nextActive);
  },

  updateInstance: async (id, patch) => {
    const { instances, activeInstanceId } = get();
    const next = instances.map((i) => (i.id === id ? { ...i, ...patch } : i));
    set({ instances: next });
    await persist(next, activeInstanceId);
  },

  removeInstance: async (id) => {
    const { instances, activeInstanceId } = get();
    const next = instances.filter((i) => i.id !== id);
    const nextActive =
      activeInstanceId === id ? (next[0]?.id ?? null) : activeInstanceId;
    set({ instances: next, activeInstanceId: nextActive });
    await persist(next, nextActive);
  },

  setActive: async (id) => {
    set({ activeInstanceId: id });
    await persist(get().instances, id);
  },

  getActive: () => {
    const { instances, activeInstanceId } = get();
    return instances.find((i) => i.id === activeInstanceId) ?? null;
  },
}));
