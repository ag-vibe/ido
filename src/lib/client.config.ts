import type { Client, ResolvedRequestOptions } from "@/api-gen/client";
import type { CreateClientConfig } from "@/api-gen/client.gen";
import { clearToken, ensureValidAccessToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base-url";
import { ofetch } from "ofetch";

const AUTH_RETRIED_HEADER = "x-flodo-auth-retried";
const installedClients = new WeakSet<object>();

function isAuthEndpoint(url: string): boolean {
  return /\/auth\/(sign-in|sign-up|refresh)\/?$/.test(url);
}

async function refreshAndRetry(
  response: Response,
  request: Request,
  options: ResolvedRequestOptions,
): Promise<Response> {
  if (response.status !== 401) return response;
  if (isAuthEndpoint(request.url)) return response;
  if (request.headers.get(AUTH_RETRIED_HEADER) === "1") return response;

  const token = await ensureValidAccessToken(true);
  if (!token) {
    // 换不到新 token（无 refreshToken 或 refreshToken 已过期）
    // → session 彻底失效，清掉让 subscribeAuth 跳登录
    clearToken();
    return response;
  }

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set(AUTH_RETRIED_HEADER, "1");

  try {
    // 用 ofetch.raw 保持 _data 字段，与 client.gen.ts 的消费方式一致
    return await ofetch.raw(request.url, {
      method: request.method,
      headers: Object.fromEntries(headers.entries()),
      body: options.serializedBody || undefined,
      signal: options.signal ?? undefined,
      redirect: "follow",
      ignoreResponseError: true,
    });
  } catch {
    return response;
  }
}

export function installAuthInterceptors(...clients: Client[]): void {
  for (const c of clients) {
    if (installedClients.has(c)) continue;
    installedClients.add(c);
    c.interceptors.response.use(refreshAndRetry);
  }
}

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: getApiBaseUrl(),
  auth: async (auth) => {
    if (auth.scheme === "bearer") {
      return (await ensureValidAccessToken()) ?? undefined;
    }
    return undefined;
  },
});
