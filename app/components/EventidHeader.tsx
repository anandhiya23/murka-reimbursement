"use client";

import { createClient } from "@/utils/supabase/client";
import { LogOut, LayoutGrid } from "lucide-react";

// Shared EventID chrome: logo, back-to-launcher, sign out.
export default function EventidHeader({ subtitle }: { subtitle?: string }) {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="header-bar">
      <div className="header-left">
        <img src="/murka-logo.svg" alt="Murka" className="header-logo" />
        <span className="eventid-brand">EventID{subtitle ? ` · ${subtitle}` : ""}</span>
      </div>
      <div className="header-user">
        <a href="/" className="admin-link">
          <LayoutGrid size={14} /> Apps
        </a>
        <button type="button" className="sign-out-btn" onClick={handleSignOut}>
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
