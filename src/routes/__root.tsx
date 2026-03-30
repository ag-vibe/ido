import { HeadContent, Scripts, createRootRouteWithContext, redirect, useRouter } from "@tanstack/react-router";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";
import { auth, getToken, subscribeAuth, waitForHydration } from "../lib/auth";
import { installAuthInterceptors } from "../lib/client.config";
import { client as todoClient } from "../api-gen/client.gen";
import { client as anclaxClient } from "../api-anclax/client.gen";
import SettingsDrawer from "../components/SettingsDrawer";
import { useEffect } from "react";
import {
  getThemeInitScript,
  LIGHT_THEME_CHROME,
} from "../lib/theme";

installAuthInterceptors(todoClient, anclaxClient);
// If a request is still unauthorized after auth retry, the session is no
// longer usable for this app instance. Clear it so the route guard redirects
// back to the login page instead of leaving the board in a broken state.
todoClient.interceptors.response.use(async (response) => {
  if (response.status === 401) auth.store.getState().clearSession();
  return response;
});
anclaxClient.interceptors.response.use(async (response) => {
  if (response.status === 401) auth.store.getState().clearSession();
  return response;
});

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const isProd = import.meta.env.PROD;
const THEME_INIT_SCRIPT = getThemeInitScript();

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location }) => {
    // Auth is persisted in localStorage, so the server cannot reliably decide
    // whether the user is logged in during SSR.
    if (typeof window === "undefined") return;
    await waitForHydration();
    const isLoginPage = location.pathname === "/login";
    if (!isLoginPage && !getToken()) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "ido",
      },
      ...(isProd
        ? [
          { name: "theme-color", content: LIGHT_THEME_CHROME },
          { name: "mobile-web-app-capable", content: "yes" },
          { name: "apple-mobile-web-app-capable", content: "yes" },
          { name: "apple-mobile-web-app-status-bar-style", content: "default" },
          { name: "apple-mobile-web-app-title", content: "ido" },
        ]
        : []),
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      ...(isProd ? [{ rel: "manifest", href: "/manifest.webmanifest" }, { rel: "apple-touch-icon", href: "/logo192.png" }] : []),
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeAuth(() => {
      if (!getToken()) {
        void router.navigate({ to: "/login" });
      }
    });

    void waitForHydration().then(() => {
      if (cancelled) return;
      if (router.state.location.pathname !== "/login" && !getToken()) {
        void router.navigate({ to: "/login" });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased wrap-anywhere">
        <TanStackQueryProvider>
          {children}
          <SettingsDrawer />
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  );
}
