import { FetchError, ofetch } from "ofetch";
import { getApiBaseUrl } from "@/lib/api-base-url";

const STORAGE_KEY = "flodo.auth.v1";
const REFRESH_LEEWAY_MS = 60 * 1000;

type Listener = () => void;
const listeners = new Set<Listener>();
let refreshInFlight: Promise<AuthSession | null> | null = null;

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
}

function emitAuthChange(): void {
  listeners.forEach((fn) => fn());
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  const payload = parts[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpiringSoon(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;

  if (typeof exp !== "number") {
    // Unknown token format: avoid blocking requests; rely on 401 fallback.
    return false;
  }

  const expiresAtMs = exp * 1000;
  return Date.now() + REFRESH_LEEWAY_MS >= expiresAtMs;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed?.accessToken === "string" && parsed.accessToken.length > 0) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        tokenType: parsed.tokenType,
      };
    }
  } catch {
    // Backward compatibility: old format stored raw token string.
  }

  return raw.length > 0 ? { accessToken: raw, tokenType: "Bearer" } : null;
}

export function getToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return getAuthSession()?.refreshToken ?? null;
}

export async function refreshAuthSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const session = getAuthSession();
    if (!session?.refreshToken) return null;

    try {
      const refreshed = await ofetch<{
        accessToken: string;
        refreshToken: string;
        tokenType: string;
      }>(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        body: {
          refreshToken: session.refreshToken,
        },
      });

      const nextSession: AuthSession = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
        tokenType: refreshed.tokenType ?? session.tokenType ?? "Bearer",
      };

      setAuthSession(nextSession);
      return nextSession;
    } catch (err) {
      // Only clear the token if this is a definitive auth failure (refresh token
      // rejected by the server). Network errors and 5xx should NOT log the user
      // out — the token may still be valid once connectivity is restored.
      const isAuthFailure =
        err instanceof FetchError &&
        err.response != null &&
        err.response.status < 500;
      if (isAuthFailure) {
        clearToken();
      }
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function ensureValidAccessToken(forceRefresh = false): Promise<string | null> {
  const session = getAuthSession();
  if (!session?.accessToken) return null;

  const shouldRefresh =
    forceRefresh || (!!session.refreshToken && isTokenExpiringSoon(session.accessToken));

  if (!shouldRefresh) {
    return session.accessToken;
  }

  const refreshed = await refreshAuthSession();
  return refreshed?.accessToken ?? null;
}

export function setAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  emitAuthChange();
}

export function setToken(token: string): void {
  setAuthSession({ accessToken: token, tokenType: "Bearer" });
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitAuthChange();
}

export function subscribeAuth(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
