import { useState, useRef, useEffect } from "react";
import { Drawer } from "vaul";
import ThemeToggle from "./ThemeToggle";
import { clearToken } from "../lib/auth";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { listTodosOptions } from "../api-gen/@tanstack/react-query.gen";
import { deleteTodo } from "../api-gen/sdk.gen";
import type { TodoItem } from "../api-gen/types.gen";
import { getApiBaseUrl, setApiBaseUrl, getDefaultApiBaseUrl } from "../lib/api-base-url";
import { getQueue, drainQueue } from "../lib/pending-sync";

function useExportData() {
  const queryClient = useQueryClient();
  return () => {
    const todos = queryClient.getQueryData<TodoItem[]>(listTodosOptions().queryKey) ?? [];
    const blob = new Blob([JSON.stringify({ version: 1, todos }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ido-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

function ImportButton({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed?.todos) throw new Error("Invalid format");
        localStorage.setItem("ido.import.pending", JSON.stringify(parsed.todos));
        setStatus("ok");
        setTimeout(() => { setStatus("idle"); onClose(); }, 1200);
      } catch {
        setStatus("err");
        setTimeout(() => setStatus("idle"), 2000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => fileRef.current?.click()} className="sd-row">
        <span className="sd-row-label">Import data</span>
        {status === "ok" && <span className="sd-badge sd-badge--ok">Imported</span>}
        {status === "err" && <span className="sd-badge sd-badge--err">Invalid file</span>}
      </button>
    </>
  );
}

function SyncRow() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(() => getQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const refresh = () => setPending(getQueue().length);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("flodo:queue-changed", refresh);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("flodo:queue-changed", refresh);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (syncing || !online) return;
    setSyncing(true);
    await drainQueue(queryClient).catch(() => null);
    setPending(getQueue().length);
    setSyncing(false);
  };

  const statusLabel = !online
    ? "Offline"
    : syncing
    ? "Syncing…"
    : pending > 0
    ? `${pending} pending`
    : "Up to date";

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={!online || syncing || pending === 0}
      className="sd-row"
      style={{ opacity: (!online || pending === 0) && !syncing ? 0.5 : 1, cursor: pending === 0 || !online ? "default" : "pointer" }}
    >
      <span className="sd-row-label">Sync now</span>
      <span className="sd-row-hint">{statusLabel}</span>
    </button>
  );
}

const SHORTCUTS = [
  { keys: ["Enter"], desc: "Confirm / add todo" },
  { keys: ["Esc"], desc: "Cancel editing" },
  { keys: ["Click"], desc: "Check off todo" },
] as const;

function ShortcutsRow() {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="sd-row">
        <span className="sd-row-label">Keyboard shortcuts</span>
        <span className="sd-row-hint">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="sd-shortcuts">
          {SHORTCUTS.map(({ keys, desc }) => (
            <div key={desc} className="sd-shortcut-row">
              <span className="sd-shortcut-desc">{desc}</span>
              <span className="sd-shortcut-keys">
                {keys.map((k) => (
                  <kbd key={k} className="sd-kbd">{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ClearDoneButton() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"idle" | "ok">("idle");

  const handleClear = async () => {
    const todos = queryClient.getQueryData<TodoItem[]>(listTodosOptions().queryKey) ?? [];
    const done = todos.filter((t) => t.done);
    if (!done.length) return;
    await Promise.all(
      done.map((t) => deleteTodo({ path: { id: t.id } }).catch(() => null))
    );
    await queryClient.invalidateQueries({ queryKey: listTodosOptions().queryKey });
    setStatus("ok");
    setTimeout(() => setStatus("idle"), 1500);
  };

  return (
    <button type="button" onClick={handleClear} className="sd-row">
      <span className="sd-row-label">Clear completed</span>
      {status === "ok" && <span className="sd-badge sd-badge--ok">Done</span>}
    </button>
  );
}

function ApiUrlRow() {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const defaultUrl = getDefaultApiBaseUrl();

  const current = getApiBaseUrl();
  const isCustom = current !== defaultUrl;

  const startEdit = () => {
    setValue(current);
    setEditing(true);
  };

  const save = () => {
    setApiBaseUrl(value);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const reset = () => {
    setApiBaseUrl("");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="sd-row sd-row--input">
        <input
          className="sd-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
          placeholder={defaultUrl}
          spellCheck={false}
        />
        <button type="button" className="sd-input-btn" onClick={save}>Save</button>
        <button type="button" className="sd-input-btn sd-input-btn--muted" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <button type="button" onClick={startEdit} className="sd-row">
      <span className="sd-row-label">API endpoint</span>
      {saved && <span className="sd-badge sd-badge--ok">Saved</span>}
      {!saved && isCustom && <span className="sd-badge sd-badge--custom">Custom</span>}
      {!saved && !isCustom && <span className="sd-row-hint">default</span>}
      {isCustom && !saved && (
        <button
          type="button"
          className="sd-input-btn sd-input-btn--muted"
          onClick={(e) => { e.stopPropagation(); reset(); }}
        >
          Reset
        </button>
      )}
    </button>
  );
}

export default function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const exportData = useExportData();

  const handleSignOut = () => {
    clearToken();
    void router.navigate({ to: "/login" });
    setOpen(false);
  };

  return (
    <>
      {/* Floating capsule */}
      <div className="sd-trigger-wrap">
        <div className="sd-capsule">
          <ThemeToggle />
          <div className="sd-capsule-divider" />
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="sd-capsule-btn"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M11 11l3-3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="sd-capsule-divider" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="More settings"
            className="sd-capsule-btn"
          >
            <span className="sd-capsule-dot" />
            <span className="sd-capsule-dot" />
            <span className="sd-capsule-dot" />
          </button>
        </div>
      </div>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="sd-overlay" />
          <Drawer.Content aria-describedby={undefined} className="sd-content">
            <div className="sd-handle-wrap">
              <div className="sd-handle" />
            </div>

            <div className="sd-inner">
              <Drawer.Title className="sd-title">Settings</Drawer.Title>

              {/* Appearance */}
              <div className="sd-group">
                <div className="sd-row sd-row--spread">
                  <span className="sd-row-label">Theme</span>
                  <ThemeToggle />
                </div>
              </div>

              {/* Sync */}
              <div className="sd-group">
                <SyncRow />
              </div>

              {/* Data */}
              <div className="sd-group">
                <button type="button" onClick={exportData} className="sd-row">
                  <span className="sd-row-label">Export data</span>
                  <span className="sd-row-hint">.json</span>
                </button>
                <div className="sd-group-divider" />
                <ImportButton onClose={() => setOpen(false)} />
                <div className="sd-group-divider" />
                <ClearDoneButton />
              </div>

              {/* Server */}
              <div className="sd-group">
                <ApiUrlRow />
              </div>

              {/* Shortcuts */}
              <div className="sd-group">
                <ShortcutsRow />
              </div>

              {/* Account */}
              <div className="sd-group">
                <button type="button" onClick={handleSignOut} className="sd-row sd-row--danger">
                  <span className="sd-row-label">Sign out</span>
                </button>
              </div>

              <p className="sd-about">ido · v1.0 · Built with TanStack Start</p>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
