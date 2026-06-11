"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import EventidHeader from "@/app/components/EventidHeader";
import EventBanner from "@/app/components/eventid/EventBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, ArrowRight, Copy } from "lucide-react";

interface EventRow {
  id: number; name: string; slug: string; is_open: boolean; banner_url: string | null;
}

export default function EventsPage() {
  const { data, error, isLoading, mutate } = useSWR<EventRow[]>("/api/eventid/events");
  const events = Array.isArray(data) ? data : [];
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Route returns 403 for non-admins -> bounce to the dashboard.
  useEffect(() => { if (error) window.location.href = "/eventid"; }, [error]);

  async function create() {
    if (!name.trim()) return;
    const res = await fetch("/api/eventid/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc }),
    });
    const j = await res.json();
    if (!res.ok) { toast.error(j.error); return; }
    window.location.href = `/eventid/e/${j.slug}`;
  }

  async function toggle(ev: EventRow) {
    await fetch("/api/eventid/events", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ev.id, action: "toggle_open", is_open: !ev.is_open }),
    });
    mutate();
  }

  return (
    <>
      <EventidHeader subtitle="Events" />
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Create event</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2 flex-1 min-w-48"><Label>Event name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pesta Inklusif 2026" /></div>
            <div className="grid gap-2 flex-1 min-w-48"><Label>Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" /></div>
            <Button onClick={create}><Plus className="h-4 w-4" /> Create</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-lg" />)
            : events.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p>
            : events.map((ev) => (
              <Card key={ev.id} className="flex flex-col overflow-hidden p-0">
                <EventBanner url={ev.banner_url} name={ev.name} rounded="rounded-none"
                  className="border-0 border-b" />
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-display font-semibold uppercase tracking-wide">{ev.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">/e/{ev.slug}</div>
                    </div>
                    <label className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-medium ${ev.is_open ? "text-primary" : "text-muted-foreground"}`}>
                        {ev.is_open ? "Open" : "Closed"}
                      </span>
                      <Switch checked={ev.is_open} onCheckedChange={() => toggle(ev)} />
                    </label>
                  </div>
                  <div className="mt-auto flex gap-2 border-t border-border pt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(`${origin}/e/${ev.slug}`); toast.success("Link copied"); }}>
                      <Copy className="h-4 w-4" /> Copy link
                    </Button>
                    <Button size="sm" className="flex-1" asChild>
                      <Link href={`/eventid/e/${ev.slug}`}>Manage <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </>
  );
}
