"use client";

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutGrid } from "lucide-react";

// EventID credential topbar.
export default function EventidHeader({ subtitle }: { subtitle?: string }) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
        <a href="/eventid" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-primary text-primary-foreground text-[11px] font-bold font-mono shadow-[0_0_18px_-2px_var(--primary)]">
            ID
          </span>
          <span className="font-display text-lg font-bold uppercase tracking-[0.14em] leading-none">
            Event<span className="text-primary">ID</span>
          </span>
        </a>
        {subtitle && (
          <span className="eid-eyebrow hidden sm:inline border-l border-border pl-3 truncate max-w-[38vw]">
            {subtitle}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <a href="/"><LayoutGrid className="h-4 w-4" /> Apps</a>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
      <div className="eid-perforation h-[6px] opacity-60" />
    </header>
  );
}
