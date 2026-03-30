import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";
import { LIGHT_THEME_CHROME } from "./src/lib/theme";

const isProd = process.env.NODE_ENV === "production";

const config = defineConfig({
  lint: { options: { typeAware: true, typeCheck: true } },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] }, 
      compatibilityDate: "2024-09-19",
      preset: "cloudflare_module",
      cloudflare: {
        deployConfig: true,
        nodeCompat: true
      }
    }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true
      }
    }),
    viteReact(),
    VitePWA({
      registerType: "autoUpdate",
      // "null" skips the HTML-transform injection; we add the <link> manually
      // in __root.tsx because TanStack Start renders HTML through React.
      injectRegister: null,
      // Never enable PWA in dev, otherwise stale SW/cache can break local DX.
      devOptions: { enabled: false, type: "module" },
      manifest: {
        name: "ido",
        short_name: "ido",
        description: "idea + todo = ido. Collect your ideas and tasks.",
        theme_color: LIGHT_THEME_CHROME,
        background_color: LIGHT_THEME_CHROME,
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "favicon.ico",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/x-icon",
          },
          {
            src: "logo192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "logo512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Only precache static assets — never HTML.
        // HTML may contain dehydrated router/query state from SSR; caching it
        // would cause the SW to serve a stale "unauthenticated" shell even when
        // localStorage holds a valid token, sending logged-in users to /login.
        globPatterns: isProd ? ["**/*.{js,css,ico,png,svg,woff,woff2}"] : [],
        // No navigateFallback: navigation requests always go to the network so
        // the server (Cloudflare) serves fresh HTML. Cloudflare Pages already
        // handles the SPA fallback itself.
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});

export default config;
