"use client";

import { useState, useEffect } from "react";
import EventidHeader from "@/app/components/EventidHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, ArrowRight, Copy } from "lucide-react";

interface EventRow {
  id: number; name: string; slug: string; is_open: boolean;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function load() {
    const res = await fetch("/api/eventid/events");
    if (res.status === 403) { window.location.href = "/eventid"; return; }
    const data = await res.json();
    if (Array.isArray(data)) setEvents(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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
    load();
  }

  return (
    <>
      <EventidHeader subtitle="Events" />
      <div className="mx-auto max-w-4xl p-4 md:p-6 space-y-6">
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

        <div className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : events.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p>
            : events.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-3">
                  <div>
                    <div className="font-medium">{ev.name}</div>
                    <div className="text-xs text-muted-foreground">/e/{ev.slug}</div>
                  </div>
                  {ev.is_open ? <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Open</Badge> : <Badge variant="outline">Closed</Badge>}
                  <div className="ml-auto flex items-center gap-2">
                    <Switch checked={ev.is_open} onCheckedChange={() => toggle(ev)} />
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${origin}/e/${ev.slug}`); toast.success("Link copied"); }}>
                      <Copy className="h-4 w-4" /> Link
                    </Button>
                    <Button size="sm" asChild><a href={`/eventid/e/${ev.slug}`}>Manage <ArrowRight className="h-4 w-4" /></a></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </>
  );
}
