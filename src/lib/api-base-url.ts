const DEFAULT_API_BASE_URL = "https://allinone.wibus.ren/api/v1";

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured;
  return DEFAULT_API_BASE_URL;
}
