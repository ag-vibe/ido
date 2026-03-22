import { client as anclaxClient } from "@/api-anclax/client.gen";
import { client as todoClient } from "@/api-gen/client.gen";
import { ensureValidAccessToken } from "@/lib/auth";

type InterceptableClient = {
  interceptors: {
    response: {
      use: (
        fn: (
          response: Response,
          request: Request,
          options: {
            serializedBody?: unknown;
            signal?: AbortSignal;
          }
        ) => Promise<Response> | Response
      ) => number;
    };
  };
};

declare global {
  interface Window {
    __flodoAuthRefreshInstalled__?: boolean;
  }
}

const RETRY_MARKER_HEADER = "x-flodo-auth-retried";

function isAuthEndpoint(url: string): boolean {
  return /\/auth\/(sign-in|sign-up|refresh)\/?$/.test(url);
}

function getRetryBody(options: { serializedBody?: unknown }): BodyInit | undefined {
  const body = options.serializedBody;
  if (typeof body === "string") {
    return body.length > 0 ? body : undefined;
  }

  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body;
  }

  return undefined;
}

function install401RetryInterceptor(client: InterceptableClient): void {
  client.interceptors.response.use(async (response, request, options) => {
    if (response.status !== 401) return response;
    if (isAuthEndpoint(request.url)) return response;
    if (request.headers.get(RETRY_MARKER_HEADER) === "1") return response;

    const refreshedToken = await ensureValidAccessToken(true);
    if (!refreshedToken) return response;

    const retryHeaders = new Headers(request.headers);
    retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    retryHeaders.set(RETRY_MARKER_HEADER, "1");

    try {
      const retried = await fetch(request.url, {
        method: request.method,
        headers: retryHeaders,
        body: getRetryBody(options),
        signal: options.signal,
        redirect: "follow",
      });
      return retried;
    } catch {
      return response;
    }
  });
}

function installAuthRefreshInterceptors(): void {
  install401RetryInterceptor(todoClient as unknown as InterceptableClient);
  install401RetryInterceptor(anclaxClient as unknown as InterceptableClient);
}

if (typeof window !== "undefined" && !window.__flodoAuthRefreshInstalled__) {
  window.__flodoAuthRefreshInstalled__ = true;
  installAuthRefreshInterceptors();
}
