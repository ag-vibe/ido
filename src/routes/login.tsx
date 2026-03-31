import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { deviceAuthorizeMutation, deviceTokenMutation } from "@/api-gen/@tanstack/react-query.gen";
import { getToken, setAuthSession, waitForHydration } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base-url";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    await waitForHydration();
    if (getToken()) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = Route.useNavigate();

  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [intervalSec, setIntervalSec] = useState<number>(5);
  const [status, setStatus] = useState<string>("Preparing device login...");
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const authorizeMutation = useMutation(deviceAuthorizeMutation());
  const tokenMutation = useMutation(deviceTokenMutation());

  const isLoading = authorizeMutation.isPending || tokenMutation.isPending;

  const title = "Continue on another device";
  const subtitle = "Open the verification page, sign in, and we will finish here automatically.";

  const canOpen = Boolean(verificationUrl);
  const displayCode = useMemo(() => userCode ?? "—", [userCode]);
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const resolvedVerificationUrl = useMemo(() => {
    if (!verificationUrl) return null;
    try {
      return new URL(verificationUrl, apiBase).toString();
    } catch {
      return verificationUrl;
    }
  }, [verificationUrl, apiBase]);

  useEffect(() => {
    void startDeviceLogin();
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  async function startDeviceLogin() {
    setError(null);
    setStatus("Requesting device code...");
    try {
      const res = await authorizeMutation.mutateAsync({
        body: {
          clientId: "todo",
        },
      });
      setDeviceCode(res.deviceCode);
      setUserCode(res.userCode);
      setVerificationUrl(res.verificationUriComplete);
      setIntervalSec(res.interval || 5);
      setStatus("Device code ready. Open the verification page.");
      schedulePoll(res.deviceCode, res.interval || 5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start device login.");
      setStatus("Failed to request device code.");
    }
  }

  function schedulePoll(code: string, interval: number) {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }
    pollTimerRef.current = window.setTimeout(() => {
      void pollToken(code, interval);
    }, Math.max(1, interval) * 1000);
  }

  async function pollToken(code: string, interval: number) {
    try {
      const res = await tokenMutation.mutateAsync({
        body: { deviceCode: code },
      });

      if (res.accessToken && res.refreshToken && res.tokenType) {
        setStatus("Login approved. Redirecting...");
        if (pollTimerRef.current) {
          window.clearTimeout(pollTimerRef.current);
        }
        setAuthSession({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          tokenType: res.tokenType,
        });
        void navigate({ to: "/" });
        return;
      }

      if (res.error === "slow_down") {
        setStatus(res.errorDescription ?? "Waiting for approval...");
        schedulePoll(code, interval + 2);
        return;
      }

      if (res.error === "expired_token") {
        setStatus("Device code expired. Restarting...");
        void startDeviceLogin();
        return;
      }

      if (res.error === "access_denied") {
        setStatus("Access denied. Restarting...");
        void startDeviceLogin();
        return;
      }

      setStatus(res.errorDescription ?? "Waiting for approval...");
      schedulePoll(code, interval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polling failed.");
      schedulePoll(code, interval + 2);
    }
  }

  function handleOpenVerification() {
    if (!resolvedVerificationUrl) return;
    window.open(resolvedVerificationUrl, "_blank", "width=480,height=640");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-(--bg-base) px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[var(--glow-a)] blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[var(--glow-b)] blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-[0_30px_80px_var(--card-shadow)] backdrop-blur-sm sm:p-8">
        <p className="mb-2 text-[11px] tracking-[0.22em] text-[var(--label-muted)] uppercase">
          flodo authentication
        </p>
        <h1 className="text-2xl font-medium text-(--sea-ink)">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-(--sea-ink-soft)">{subtitle}</p>

        <div className="mt-6 rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)] p-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--label-muted)]">
            User code
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[0.3em] text-(--sea-ink)">
            {displayCode}
          </p>
          <p className="mt-2 text-xs text-(--sea-ink-soft)">
            {deviceCode ? "Waiting for approval..." : "Requesting device code..."}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error-text)]">
            {error}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleOpenVerification}
            disabled={!canOpen}
            className="inline-flex w-full items-center justify-center rounded-xl bg-(--sea-ink) px-4 py-2.5 text-sm text-[var(--btn-primary-text)] shadow-[0_10px_24px_var(--btn-shadow)] transition hover:-translate-y-px hover:shadow-[0_14px_32px_var(--btn-shadow-hover)] disabled:translate-y-0 disabled:opacity-70"
          >
            Open verification page
          </button>
          <button
            type="button"
            onClick={() => void startDeviceLogin()}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--input-border)] px-4 py-2.5 text-sm text-(--sea-ink) transition hover:bg-[var(--input-bg)] disabled:opacity-70"
          >
            Refresh code
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-(--sea-ink-soft)">
          {status}
        </p>
      </section>
    </main>
  );
}
