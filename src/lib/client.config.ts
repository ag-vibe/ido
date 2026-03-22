import type { CreateClientConfig } from "@/api-gen/client.gen";
import { getToken } from "@/lib/auth";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  auth: (auth) => {
    if (auth.scheme === "bearer") {
      return getToken() ?? undefined;
    }
    return undefined;
  },
});
