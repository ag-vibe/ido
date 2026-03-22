const STORAGE_KEY = "flodo.auth.v1";

type Listener = () => void;
const listeners = new Set<Listener>();

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
  listeners.forEach((fn) => fn());
}

export function clearToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((fn) => fn());
}

export function subscribeAuth(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
