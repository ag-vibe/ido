import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueue, drainQueue } from "@/lib/pending-sync";

type Status = "online" | "offline" | "syncing";

export default function SyncStatus() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online"
  );
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const refresh = () => setPendingCount(getQueue().length);
    refresh();

    const handleOnline = () => {
      setStatus("syncing");
      setPendingCount(getQueue().length);
      drainQueue(queryClient).finally(() => {
        setPendingCount(getQueue().length);
        setStatus("online");
      });
    };

    const handleOffline = () => {
      setStatus("offline");
      refresh();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Also track any enqueue events via a custom event
    window.addEventListener("flodo:queue-changed", refresh);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("flodo:queue-changed", refresh);
    };
  }, [queryClient]);

  if (status === "online" && pendingCount === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none"
      style={{
        background:
          status === "offline"
            ? "rgba(239,68,68,0.1)"
            : status === "syncing"
              ? "rgba(99,102,241,0.1)"
              : "rgba(234,179,8,0.1)",
        color:
          status === "offline"
            ? "rgb(220,38,38)"
            : status === "syncing"
              ? "rgb(99,102,241)"
              : "rgb(161,128,0)",
      }}
    >
      {status === "offline" && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {pendingCount > 0 ? `离线 · ${pendingCount} 待同步` : "离线"}
        </>
      )}
      {status === "syncing" && (
        <>
          <span
            className="h-3 w-3"
            style={{ animation: "spin 1s linear infinite", display: "inline-block" }}
          >
            ↻
          </span>
          同步中…
        </>
      )}
      {status === "online" && pendingCount > 0 && (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
          {pendingCount} 待同步
        </>
      )}
    </span>
  );
}
