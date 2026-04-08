import { useMemo } from "react";
import { SigNozClient } from "@sigpocket/signoz-client";
import { useInstanceStore } from "@/stores/instance-store";

export function useSignozClient(): SigNozClient | null {
  const active = useInstanceStore((s) => s.getActive());

  return useMemo(() => {
    if (!active) return null;
    return new SigNozClient({ baseUrl: active.baseUrl, apiKey: active.apiKey });
  }, [active?.id, active?.baseUrl, active?.apiKey]);
}
