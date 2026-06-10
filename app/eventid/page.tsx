"use client";

import { useState, useEffect } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import { CalendarDays, FolderKanban, ArrowUpRight } from "lucide-react";

interface Division { id: number; name: string; event_name: string }

export default function EventidDashboard() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    fetch("/api/eventid/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => { setIsAdmin(!!data.isAdmin); setDivisions(data.divisions ?? []); setLoading(false); })
      .catch(() => { window.location.href = "/"; });
  }, []);

  if (loading) return (<><EventidHeader /><div className="p-8 text-sm text-muted-foreground font-mono">Loading…</div></>);

  return (
    <>
      <EventidHeader />
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 space-y-10">
        <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="eid-eyebrow">Credential Control</p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Issue. Verify. Print.</h1>
        </div>

        {isAdmin && (
          <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
            <p className="eid-eyebrow">Admin</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <a href="/eventid/events"
                className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition hover:border-primary/60">
                <CalendarDays className="h-6 w-6 text-primary" />
                <div className="mt-3 font-display text-lg font-semibold uppercase tracking-wide">Events</div>
                <p className="text-sm text-muted-foreground mt-0.5">Create events, divisions, PICs, public forms, print IDs</p>
                <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground transition group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </section>
        )}

        <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
          <p className="eid-eyebrow">My Divisions · {divisions.length}</p>
          {divisions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {isAdmin ? "You aren't assigned to any division as PIC." : "No divisions assigned yet. Contact an admin."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {divisions.map((d) => (
                <a key={d.id} href={`/eventid/divisions/${d.id}`}
                  className="group rounded-lg border border-border bg-card p-5 transition hover:border-primary/60">
                  <FolderKanban className="h-5 w-5 text-primary" />
                  <div className="mt-3 font-display text-base font-semibold uppercase tracking-wide truncate">{d.name}</div>
                  <p className="eid-eyebrow mt-1 truncate normal-case">{d.event_name}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
