"use client";

import { createClient } from "@/utils/supabase/client";
import { LogOut, LayoutGrid } from "lucide-react";
import SiteHeader from "@/app/components/SiteHeader";

// EventID topbar — thin wrapper over the shared shadcn SiteHeader.
export default function EventidHeader({ subtitle }: { subtitle?: string }) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <SiteHeader
      subtitle={subtitle}
      actions={[
        { label: "Apps", icon: LayoutGrid, href: "/" },
        { label: "Sign out", icon: LogOut, onClick: handleSignOut, variant: "outline" },
      ]}
    />
  );
}
