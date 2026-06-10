"use client";

import { useState, useEffect } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, FolderKanban } from "lucide-react";

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

  if (loading) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Loading…</div></>);

  return (
    <>
      <EventidHeader />
      <div className="mx-auto max-w-4xl p-4 md:p-6 space-y-8">
        {isAdmin && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Admin</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <a href="/eventid/events">
                <Card className="transition hover:border-foreground/30 hover:shadow-sm">
                  <CardHeader>
                    <CalendarDays className="h-6 w-6" />
                    <CardTitle>Events</CardTitle>
                    <CardDescription>Create events, divisions, assign PICs, open/close forms, print IDs</CardDescription>
                  </CardHeader>
                </Card>
              </a>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">My Divisions</h2>
          {divisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "You aren't assigned to any division as PIC." : "You aren't assigned to any division yet. Contact an admin."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {divisions.map((d) => (
                <a key={d.id} href={`/eventid/divisions/${d.id}`}>
                  <Card className="transition hover:border-foreground/30 hover:shadow-sm">
                    <CardHeader>
                      <FolderKanban className="h-6 w-6" />
                      <CardTitle className="text-base">{d.name}</CardTitle>
                      <CardDescription>{d.event_name}</CardDescription>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
