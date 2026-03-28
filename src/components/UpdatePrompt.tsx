import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Listens for Service Worker updates and shows a small banner when a new
 * version of the app is available. The user can reload to apply it.
 */
export default function UpdatePrompt() {
  if (!import.meta.env.PROD) return null;

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Periodically check for updates every hour
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--row-border)] bg-(--surface) px-4 py-3 shadow-lg text-sm text-(--sea-ink)"
    >
      <span>New version available.</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="rounded-md bg-[var(--btn-tint)] px-3 py-1 text-xs font-medium hover:bg-[var(--btn-tint-hover)] transition"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        className="text-(--sea-ink-soft) hover:text-(--sea-ink) transition"
      >
        ×
      </button>
    </div>
  );
}
