"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr";

// Global SWR defaults. `fetcher` is the shared one so each useSWR call only
// needs a key. Revalidate on focus/reconnect for fresh data; dedupe bursts.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
