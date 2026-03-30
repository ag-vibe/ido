import { HeadContent, Scripts, createRootRouteWithContext, redirect, useRouter } from "@tanstack/react-router";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";
import { getToken, subscribeAuth, waitForHydration } from "../lib/auth";
import { installAuthInterceptors } from "../lib/client.config";
import { client as todoClient } from "../api-gen/client.gen";
import { client as anclaxClient } from "../api-anclax/client.gen";
import UpdatePrompt from "../components/UpdatePrompt";
import SettingsDrawer from "../components/SettingsDrawer";
import { useEffect } from "react";
import {
  getThemeInitScript,
  LIGHT_THEME_CHROME,
} from "../lib/theme";

installAuthInterceptors(todoClient, anclaxClient);

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const isProd = import.meta.env.PROD;
const THEME_INIT_SCRIPT = getThemeInitScript();

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location }) => {
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
    return subscribeAuth(() => {
      if (!getToken()) {
        void router.navigate({ to: "/login" });
      }
    });
  }, [router]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;

    void (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.allSettled(registrations.map((registration) => registration.unregister()));
        }

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.allSettled(keys.map((key) => caches.delete(key)));
        }
      } catch (error) {
        console.warn("Failed to cleanup service worker/cache in dev", error);
      }
    })();
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
        <UpdatePrompt />
        <Scripts />
      </body>
    </html>
  );
}
