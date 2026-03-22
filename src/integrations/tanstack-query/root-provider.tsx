import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const CACHE_KEY = "flodo.query-cache.v1";

let context:
  | {
    queryClient: QueryClient;
  }
  | undefined;

export function getContext() {
  if (context) {
    return context;
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data in cache for 24 hours so offline page refreshes still show data
        gcTime: 1000 * 60 * 60 * 24,
        staleTime: 1000 * 30,
      },
    },
  });

  if (typeof window !== "undefined") {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: CACHE_KEY,
    });
    persistQueryClient({ queryClient, persister });
  }

  context = { queryClient };
  return context;
}

export default function TanStackQueryProvider({ children }: { children: ReactNode }) {
  const { queryClient } = getContext();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
