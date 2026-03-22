import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: [
    "../allinone/api/v1.yaml",
    "https://raw.githubusercontent.com/cloudcarver/anclax/refs/tags/v0.9.1/api/v1.yaml"
  ],
  output: {
    path: "./src/api-gen",
    clean: true,
    preferExportAll: true,
  },
  parser: {
    filters: {
      operations: {
        include: ["/^[A-Z]+ \/todos(\\/|$)/"],
      },
      orphans: false,
      preserveOrder: true,
    },
  },
  plugins: [
    {
      name: "@hey-api/client-ofetch",
      runtimeConfigPath: "@/lib/client.config",
      exportFromIndex: true,
    },
    {
      name: "@tanstack/react-query",
    },
    {
      name: "zod",
      responses: false,
    },
    {
      name: "@hey-api/sdk",
      validator: true,
    },
  ],
});
