"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import EventBanner from "@/app/components/eventid/EventBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, ArrowUpRight } from "lucide-react";

interface Division { id: number; name: string; event_name: string; event_banner_url: string | null }
interface MeResponse { isAdmin?: boolean; divisions?: Division[] }

export default function EventidDashboard() {
  const { data, error, isLoading } = useSWR<MeResponse>("/api/eventid/me");

  const isAdmin = !!data?.isAdmin;
  const divisions = data?.divisions ?? [];

  // This route gates access; on any non-auth failure bounce to the launcher.
  useEffect(() => {
    if (error) window.location.href = "/";
  }, [error]);

  if (isLoading || (!data && !error)) return (
    <>
      <EventidHeader />
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-8 space-y-8">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
        </div>
      </div>
    </>
  );

  return (
    <>
      <EventidHeader />
      <div className="mx-auto max-w-5xl px-4 md:px-6 py-8 space-y-10">
        <div className="space-y-1">
          <p className="eid-eyebrow">Credential Control</p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Issue. Verify. Print.</h1>
        </div>

        {isAdmin && (
          <section className="space-y-3">
            <p className="eid-eyebrow">Admin</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/eventid/events"
                className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition hover:border-primary/60">
                <CalendarDays className="h-6 w-6 text-primary" />
                <div className="mt-3 font-display text-lg font-semibold uppercase tracking-wide">Events</div>
                <p className="text-sm text-muted-foreground mt-0.5">Create events, divisions, PICs, public forms, print IDs</p>
                <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground transition group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <p className="eid-eyebrow">My Divisions · {divisions.length}</p>
          {divisions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {isAdmin ? "You aren't assigned to any division as PIC." : "No divisions assigned yet. Contact an admin."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {divisions.map((d) => (
                <Link key={d.id} href={`/eventid/divisions/${d.id}`}
                  className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary/60">
                  <EventBanner url={d.event_banner_url} name={d.event_name} rounded="rounded-none"
                    className="border-0 border-b" />
                  <div className="flex flex-1 flex-col gap-0.5 p-4">
                    <div className="truncate font-display text-base font-semibold uppercase tracking-wide">{d.name}</div>
                    <p className="eid-eyebrow truncate normal-case">{d.event_name}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
