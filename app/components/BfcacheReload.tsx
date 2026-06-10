"use client";

import { useEffect } from "react";

// Pages fetch data in useEffect, which does NOT re-run when the browser restores
// a page from the back/forward (bfcache) — a snapshot frozen mid-load would show
// a stuck spinner. Force a fresh load on bfcache restore. `persisted` is only
// true for actual bfcache restores, so normal navigations are unaffected.
export default function BfcacheReload() {
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}
