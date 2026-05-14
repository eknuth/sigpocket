// Tiny page-view beacon for sigpocket.com.
// Posts a minimal JSON payload to /api/otlp once per page lifecycle.
// No keys in the browser. The Pages Function builds the OTLP span and
// forwards to SigNoz.
(() => {
  if (typeof window === "undefined") return;
  if (!navigator.sendBeacon) return;

  const startedAt = performance.now();
  let sent = false;

  function send() {
    if (sent) return;
    sent = true;

    let payload;
    try {
      payload = JSON.stringify({
        url: location.href,
        referrer: document.referrer || "",
        ua: navigator.userAgent || "",
        lang: navigator.language || "",
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    } catch {
      return;
    }

    try {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/otlp", blob);
    } catch {
      // ignore
    }
  }

  addEventListener("pagehide", send, { once: false });
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
  });
})();
