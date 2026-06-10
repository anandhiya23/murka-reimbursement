"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import EventidHeader from "@/app/components/EventidHeader";
import MembersPanel from "@/app/components/eventid/MembersPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Link2, UserPlus, Mail, X } from "lucide-react";

interface EventRow {
  id: number; name: string; slug: string; description: string | null;
  starts_on: string | null; ends_on: string | null; is_open: boolean;
}
interface Division { id: number; name: string; slug: string; event_slug: string }
interface Pic { id: number; division_id: number; email: string }

export default function EventWorkspace() {
  const { slug } = useParams();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [pics, setPics] = useState<Record<number, Pic[]>>({});
  const [stats, setStats] = useState({ applicant: 0, member: 0, printed: 0 });
  const [notFound, setNotFound] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const loadEvent = useCallback(async () => {
    const res = await fetch("/api/eventid/events");
    if (res.status === 403) { window.location.href = "/eventid"; return; }
    const list: EventRow[] = await res.json();
    const ev = (list ?? []).find((e) => e.slug === slug) ?? null;
    if (!ev) { setNotFound(true); return; }
    setEvent(ev);
  }, [slug]);

  const loadDivisions = useCallback(async (eventId: number) => {
    const res = await fetch(`/api/eventid/divisions?eventId=${eventId}`);
    const divs: Division[] = await res.json();
    setDivisions(Array.isArray(divs) ? divs : []);
    const entries = await Promise.all((divs ?? []).map(async (d) => {
      const r = await fetch(`/api/eventid/pics?divisionId=${d.id}`);
      return [d.id, r.ok ? await r.json() : []] as const;
    }));
    setPics(Object.fromEntries(entries));
  }, []);

  const loadStats = useCallback(async (eventId: number) => {
    const res = await fetch(`/api/eventid/members?eventId=${eventId}`);
    const rows: { status: string; printed_at: string | null }[] = res.ok ? await res.json() : [];
    setStats({
      applicant: rows.filter((r) => r.status === "applicant").length,
      member: rows.filter((r) => r.status === "member").length,
      printed: rows.filter((r) => r.printed_at).length,
    });
  }, []);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => { if (event) { loadDivisions(event.id); loadStats(event.id); } }, [event, loadDivisions, loadStats]);

  function copy(text: string, label: string) { navigator.clipboard.writeText(text); toast.success(`${label} copied`); }

  async function patchEvent(body: Record<string, unknown>) {
    const res = await fetch("/api/eventid/events", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event!.id, ...body }),
    });
    if (res.ok) { toast.success("Saved"); await loadEvent(); }
    else toast.error((await res.json()).error || "Failed");
  }

  if (notFound) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Event not found.</div></>);
  if (!event) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Loading…</div></>);

  const eventLink = `${origin}/e/${event.slug}`;

  return (
    <>
      <EventidHeader subtitle={event.name} />
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="divisions">Divisions</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {([
                ["Applicants", stats.applicant, "text-amber-400"],
                ["Members", stats.member, "text-primary"],
                ["Printed", stats.printed, "text-foreground"],
              ] as const).map(([label, value, color]) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4">
                  <p className="eid-eyebrow">{label}</p>
                  <p className={`mt-1 font-mono text-3xl font-bold ${color}`}>{String(value).padStart(2, "0")}</p>
                </div>
              ))}
            </div>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>{event.name}</CardTitle>
                  <div className="text-sm text-muted-foreground mt-1">
                    {event.is_open ? <Badge className="border-primary/40 bg-primary/15 text-primary" variant="outline">Open</Badge>
                      : <Badge variant="outline">Closed</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Accepting submissions</span>
                  <Switch checked={event.is_open} onCheckedChange={(v) => patchEvent({ action: "toggle_open", is_open: v })} />
                </div>
              </CardHeader>
              <CardContent>
                <Label>Public application link</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={eventLink} className="font-mono text-xs" />
                  <Button variant="outline" onClick={() => copy(eventLink, "Link")}><Copy className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MEMBERS */}
          <TabsContent value="members">
            <MembersPanel eventId={event.id} eventSlug={event.slug}
              divisions={divisions.map((d) => ({ id: d.id, name: d.name }))} canManage enablePrint />
          </TabsContent>

          {/* DIVISIONS */}
          <TabsContent value="divisions" className="space-y-4">
            <AddDivision eventId={event.id} onAdded={() => loadDivisions(event.id)} />
            <div className="space-y-2">
              {divisions.map((d) => {
                const link = `${origin}/e/${event.slug}/${d.slug}`;
                return (
                  <Card key={d.id}>
                    <CardContent className="flex flex-wrap items-center gap-2 py-3">
                      <span className="font-medium">{d.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">/{d.slug}</span>
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => copy(link, "Division link")}><Link2 className="h-4 w-4" /> Public link</Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="sm" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete {d.name}?</AlertDialogTitle>
                              <AlertDialogDescription>Deletes the division, its PIC links and all its members.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={async () => {
                                await fetch("/api/eventid/divisions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id }) });
                                toast.success("Deleted"); loadDivisions(event.id);
                              }}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {divisions.length === 0 && <p className="text-sm text-muted-foreground">No divisions yet.</p>}
            </div>
          </TabsContent>

          {/* TEAM */}
          <TabsContent value="team" className="space-y-4">
            <InvitePic divisions={divisions} onDone={() => loadDivisions(event.id)} />
            <div className="space-y-2">
              {divisions.map((d) => (
                <Card key={d.id}><CardContent className="py-3">
                  <div className="font-medium mb-2">{d.name}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(pics[d.id] ?? []).map((p) => (
                      <Badge key={p.id} variant="secondary" className="gap-1">
                        {p.email}
                        <button onClick={async () => {
                          await fetch("/api/eventid/pics", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ division_id: d.id, email: p.email }) });
                          loadDivisions(event.id);
                        }}><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                    <AssignPic divisionId={d.id} onDone={() => loadDivisions(event.id)} />
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings">
            <SettingsForm event={event} onSaved={patchEvent} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function AddDivision({ eventId, onAdded }: { eventId: number; onAdded: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex gap-2">
      <Input placeholder="New division name" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === "Enter" && name.trim()) {
            await fetch("/api/eventid/divisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: eventId, name }) });
            setName(""); onAdded();
          }
        }} />
      <Button onClick={async () => {
        if (!name.trim()) return;
        await fetch("/api/eventid/divisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_id: eventId, name }) });
        setName(""); onAdded();
      }}><Plus className="h-4 w-4" /> Add</Button>
    </div>
  );
}

function AssignPic({ divisionId, onDone }: { divisionId: number; onDone: () => void }) {
  const [email, setEmail] = useState("");
  return (
    <div className="flex gap-1">
      <Input className="h-8 w-48" placeholder="existing email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button size="sm" variant="outline" onClick={async () => {
        if (!email.trim()) return;
        const res = await fetch("/api/eventid/pics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ division_id: divisionId, email }) });
        if (res.ok) { setEmail(""); onDone(); } else toast.error((await res.json()).error);
      }}><UserPlus className="h-4 w-4" /></Button>
    </div>
  );
}

function InvitePic({ divisions, onDone }: { divisions: { id: number; name: string }[]; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  return (
    <Card><CardHeader><CardTitle className="text-base">Invite new PIC</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2"><Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pic@example.com" /></div>
        <div className="flex flex-wrap gap-3">
          {divisions.map((d) => (
            <label key={d.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={sel.includes(d.id)}
                onChange={(e) => setSel((s) => e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id))} />
              {d.name}
            </label>
          ))}
        </div>
        <Button onClick={async () => {
          if (!email.trim()) { toast.error("Email required"); return; }
          const res = await fetch("/api/eventid/pics/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, division_ids: sel }) });
          const j = await res.json();
          if (!res.ok) toast.error(j.error);
          else { toast.success(j.alreadyExists ? "Existing user assigned as PIC" : `Invite sent to ${email}`); setEmail(""); setSel([]); onDone(); }
        }}><Mail className="h-4 w-4" /> Send Invite</Button>
      </CardContent></Card>
  );
}

function SettingsForm({ event, onSaved }: { event: EventRow; onSaved: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState(event.name);
  const [slug, setSlug] = useState(event.slug);
  const [starts, setStarts] = useState(event.starts_on ?? "");
  const [ends, setEnds] = useState(event.ends_on ?? "");
  return (
    <Card><CardHeader><CardTitle className="text-base">Event settings</CardTitle></CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-2"><Label>Slug (URL)</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2"><Label>Starts</Label><Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Ends</Label><Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
        </div>
        <Button onClick={async () => {
          const slugChanged = slug !== event.slug;
          await onSaved({ name, slug, starts_on: starts || null, ends_on: ends || null });
          if (slugChanged) window.location.href = `/eventid/e/${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
        }}>Save</Button>
      </CardContent></Card>
  );
}
