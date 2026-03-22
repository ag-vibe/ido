import { HeadContent, Scripts, createRootRouteWithContext, redirect, useRouter } from "@tanstack/react-router";
import TanStackQueryProvider from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";
import { getToken, subscribeAuth } from "../lib/auth";
import { installAuthInterceptors } from "../lib/client.config";
import { client as todoClient } from "../api-gen/client.gen";
import { client as anclaxClient } from "../api-anclax/client.gen";
import UpdatePrompt from "../components/UpdatePrompt";
import { useEffect } from "react";

installAuthInterceptors(todoClient, anclaxClient);

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: ({ location }) => {
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
      // PWA meta tags
      { name: "theme-color", content: "#cbc0ad" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "ido" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // Manually inject the PWA manifest — TanStack Start renders the HTML
      // shell via React so Vite's HTML transform (injectRegister:"auto") never runs.
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased wrap-anywhere">
        <TanStackQueryProvider>{children}</TanStackQueryProvider>
        <UpdatePrompt />
        <Scripts />
      </body>
    </html>
  );
}
