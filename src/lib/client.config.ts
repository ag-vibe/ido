import type { CreateClientConfig } from "@/api-gen/client.gen";
import { auth, ensureValidAccessToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base-url";
import type { Client } from "@/api-gen/client";

export function installAuthInterceptors(...clients: Client[]): void {
  auth.applyTo(clients);
}

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: getApiBaseUrl(),
  auth: async (a) => {
    if (a.scheme === "bearer") {
      return (await ensureValidAccessToken()) ?? undefined;
    }
    return undefined;
  },
});
