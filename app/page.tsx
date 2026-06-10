"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { LogOut, KeyRound, Receipt, IdCard } from "lucide-react";

// Platform app launcher. Phase 1: static cards for every app.
// Step 2 makes this role-aware (only show apps the user can access).
const APPS = [
  { key: "reimbursement", name: "Reimbursement", desc: "Submit and review expense claims", href: "/reimbursement", Icon: Receipt },
  { key: "eventid", name: "EventID", desc: "Event committee IDs and lanyards", href: "/eventid", Icon: IdCard },
];

export default function LauncherPage() {
  const [email, setEmail] = useState("");
  const [allowed, setAllowed] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/apps")
      .then((res) => res.json())
      .then((data) => {
        if (data.email) setEmail(data.email);
        setAllowed(Array.isArray(data.apps) ? data.apps : []);
      })
      .catch(() => setAllowed([]));
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <div className="header-bar">
        <img src="/murka-logo.svg" alt="Murka" className="header-logo" />
        <div className="header-user">
          {email && <span>{email}</span>}
          <a href="/account" className="admin-link">
            <KeyRound size={14} /> Password
          </a>
          <button type="button" className="sign-out-btn" onClick={handleSignOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="launcher-container">
        <h1 className="launcher-title">Murka System</h1>
        <p className="launcher-subtitle">Choose an app</p>
        {allowed === null ? (
          <p className="launcher-subtitle">Loading...</p>
        ) : (
          (() => {
            const visible = APPS.filter((a) => allowed.includes(a.key));
            if (visible.length === 0) {
              return (
                <p className="launcher-subtitle">
                  You don&apos;t have access to any apps yet. Contact an admin.
                </p>
              );
            }
            return (
              <div className="launcher-grid">
                {visible.map(({ key, name, desc, href, Icon }) => (
                  <a key={key} href={href} className="launcher-card">
                    <div className="launcher-card-icon"><Icon size={28} /></div>
                    <div className="launcher-card-name">{name}</div>
                    <div className="launcher-card-desc">{desc}</div>
                  </a>
                ))}
              </div>
            );
          })()
        )}
      </div>
    </>
  );
}
