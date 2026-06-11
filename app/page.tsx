"use client";

import useSWR from "swr";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { LogOut, KeyRound, Receipt, IdCard } from "lucide-react";
import SiteHeader from "@/app/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Platform app launcher. Phase 1: static cards for every app.
// Step 2 makes this role-aware (only show apps the user can access).
const APPS = [
  { key: "reimbursement", name: "Reimbursement", desc: "Submit and review expense claims", href: "/reimbursement", Icon: Receipt },
  { key: "eventid", name: "EventID", desc: "Event committee IDs and lanyards", href: "/eventid", Icon: IdCard },
];

interface AppsResponse { email?: string; apps?: string[] }

export default function LauncherPage() {
  const { data, isLoading } = useSWR<AppsResponse>("/api/apps");

  const email = data?.email ?? "";
  const allowed = data ? (Array.isArray(data.apps) ? data.apps : []) : null;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const visible = allowed ? APPS.filter((a) => allowed.includes(a.key)) : [];

  return (
    <>
      <SiteHeader
        user={email ? <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span> : undefined}
        actions={[
          { label: "Password", icon: KeyRound, href: "/account", variant: "outline" },
          { label: "Sign out", icon: LogOut, onClick: handleSignOut, variant: "outline" },
        ]}
      />

      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight">Murka System</h1>
        <p className="mt-1 text-muted-foreground">Choose an app</p>

        {isLoading || allowed === null ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} className="h-full">
                <CardContent className="flex flex-col gap-3 p-6">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-8 text-muted-foreground">
            You don&apos;t have access to any apps yet. Contact an admin.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visible.map(({ key, name, desc, href, Icon }) => (
              <Link key={key} href={href} className="group">
                <Card className="h-full transition-colors group-hover:border-foreground/30 group-hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors group-hover:bg-(--mk-accent) group-hover:text-(--mk-primary)">
                      <Icon size={26} />
                    </div>
                    <div>
                      <div className="font-semibold">{name}</div>
                      <div className="text-sm text-muted-foreground">{desc}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
