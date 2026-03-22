import type { CreateClientConfig } from "@/api-gen/client.gen";
import { ensureValidAccessToken } from "@/lib/auth";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  auth: async (auth) => {
    if (auth.scheme === "bearer") {
      return (await ensureValidAccessToken()) ?? undefined;
    }
    return undefined;
  },
});
