import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

// In dev mode, dev-dist/ only contains the generated SW files so the glob
// pattern would match nothing. Precaching only makes sense in production.
const isProd = process.env.NODE_ENV === "production";

const config = defineConfig({
  lint: { options: { typeAware: true, typeCheck: true } },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
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
      devOptions: { enabled: true, type: "module" },
      manifest: {
        name: "ido",
        short_name: "ido",
        description: "idea + todo = ido. Collect your ideas and tasks.",
        theme_color: "#cbc0ad",
        background_color: "#f5f0e8",
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
        // Only precache built assets in production; dev-dist has no app files
        globPatterns: isProd ? ["**/*.{js,css,html,ico,png,svg,woff,woff2}"] : [],
        // SPA fallback: serve index.html for any non-file navigation
        navigateFallback: "/index.html",
        // Don't intercept API requests — TanStack Query + pending-sync handles that
        navigateFallbackDenylist: [/^\/api\//],
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
