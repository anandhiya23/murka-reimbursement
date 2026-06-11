"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { useParams } from "next/navigation";
import EventidHeader from "@/app/components/EventidHeader";
import MembersPanel from "@/app/components/eventid/MembersPanel";
import EventBanner from "@/app/components/eventid/EventBanner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Link2, UserPlus, Mail, MailPlus, RotateCw, Check, Clock, X, ImagePlus, Loader2 } from "lucide-react";

interface EventRow {
  id: number; name: string; slug: string; description: string | null;
  starts_on: string | null; ends_on: string | null; is_open: boolean;
  banner_url: string | null;
}
interface Division { id: number; name: string; slug: string; event_slug: string }
interface Pic { id: number; division_id: number; email: string }
interface UserAccount { email: string; name: string | null; confirmed: boolean }

export default function EventWorkspace() {
  const { slug } = useParams();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Event list -> pick this slug. Divisions/stats/pics are dependent: their
  // SWR key is null until the event resolves, so they never fetch with a stale id.
  const { data: eventList, error: eventError, isLoading: eventLoading, mutate: mutateEvent } =
    useSWR<EventRow[]>("/api/eventid/events");
  const event = (eventList ?? []).find((e) => e.slug === slug) ?? null;
  const notFound = !!eventList && !event;

  const { data: divisionsData, mutate: mutateDivisions } =
    useSWR<Division[]>(event ? `/api/eventid/divisions?eventId=${event.id}` : null);
  const divisions = Array.isArray(divisionsData) ? divisionsData : [];

  // One read per division for PICs, combined into a {divisionId: Pic[]} map.
  // Array key keyed on the division id list so it refetches when divisions change.
  const divIdKey = divisions.map((d) => d.id).join(",");
  const { data: pics = {}, mutate: mutatePics } = useSWR<Record<number, Pic[]>>(
    divisions.length ? ["eventid-pics", divIdKey] : null,
    async () => {
      const entries = await Promise.all(
        divisions.map(async (d) => {
          const r = await fetch(`/api/eventid/pics?divisionId=${d.id}`);
          return [d.id, r.ok ? await r.json() : []] as const;
        })
      );
      return Object.fromEntries(entries);
    }
  );

  // All accounts — powers the PIC search picker and the pending-invite badges.
  const { data: usersData } = useSWR<UserAccount[]>("/api/eventid/users");
  const users = Array.isArray(usersData) ? usersData : [];
  const userByEmail = new Map(users.map((u) => [u.email, u] as const));

  const { data: memberRows } = useSWR<{ status: string; printed_at: string | null }[]>(
    event ? `/api/eventid/members?eventId=${event.id}` : null
  );
  const stats = {
    applicant: (memberRows ?? []).filter((r) => r.status === "applicant").length,
    member: (memberRows ?? []).filter((r) => r.status === "member").length,
    printed: (memberRows ?? []).filter((r) => r.printed_at).length,
  };

  // 403 (non-admin) -> dashboard.
  useEffect(() => { if (eventError) window.location.href = "/eventid"; }, [eventError]);

  // Refresh divisions + their PICs after a division/PIC mutation.
  const refreshDivisions = useCallback(() => {
    mutateDivisions();
    mutatePics();
  }, [mutateDivisions, mutatePics]);

  function copy(text: string, label: string) { navigator.clipboard.writeText(text); toast.success(`${label} copied`); }

  async function patchEvent(body: Record<string, unknown>) {
    const res = await fetch("/api/eventid/events", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event!.id, ...body }),
    });
    if (res.ok) { toast.success("Saved"); await mutateEvent(); }
    else toast.error((await res.json()).error || "Failed");
  }

  if (notFound) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Event not found.</div></>);
  if (eventLoading || !event) return (
    <>
      <EventidHeader />
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
        <Skeleton className="h-9 w-full max-w-md" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </>
  );

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
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <EventBanner url={event.banner_url} name={event.name} rounded="rounded-lg" />
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

          {/* DIVISIONS — division + its PIC team in one card */}
          <TabsContent value="divisions" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="eid-eyebrow">{divisions.length} division{divisions.length === 1 ? "" : "s"}</p>
              <AddDivision eventId={event.id} onAdded={refreshDivisions} />
            </div>
            <AddPic divisions={divisions} users={users} pics={pics} onDone={refreshDivisions} />
            <div className="space-y-2">
              {divisions.map((d) => {
                const link = `${origin}/e/${event.slug}/${d.slug}`;
                const rows = pics[d.id] ?? [];
                return (
                  <Card key={d.id}>
                    <CardContent className="space-y-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
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
                                  toast.success("Deleted"); refreshDivisions();
                                }}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <span className="eid-eyebrow mr-1">Team</span>
                        {rows.length === 0 && <span className="text-sm text-muted-foreground">No PIC assigned</span>}
                        {rows.map((p) => (
                          <PicChip key={p.id} divisionId={d.id} email={p.email}
                            account={userByEmail.get(p.email)} onChanged={refreshDivisions} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {divisions.length === 0 && <p className="text-sm text-muted-foreground">No divisions yet.</p>}
            </div>
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-4">
            <BannerUploader event={event} onChanged={mutateEvent} />
            <SettingsForm event={event} onSaved={patchEvent} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function AddDivision({ eventId, onAdded }: { eventId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/eventid/divisions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, name }),
    });
    setBusy(false);
    if (res.ok) { toast.success("Division created"); setName(""); setOpen(false); onAdded(); }
    else toast.error((await res.json().catch(() => ({}))).error || "Failed");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> New division</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New division</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="grid gap-3">
          <div className="grid gap-2"><Label>Name</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stage, VIP, Media" required /></div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// A single PIC chip inside a division. Shows pending state for accounts that
// have not accepted their invite yet, with resend + remove actions.
function PicChip({ divisionId, email, account, onChanged }: {
  divisionId: number; email: string; account?: UserAccount; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // No matching account row == invited but never accepted (stub) -> pending.
  const pending = !account?.confirmed;

  async function remove() {
    setBusy(true);
    await fetch("/api/eventid/pics", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division_id: divisionId, email }),
    });
    onChanged();
  }
  async function resend() {
    setBusy(true);
    const res = await fetch("/api/eventid/pics/resend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (res.ok) toast.success(`Invite re-sent to ${email}`);
    else toast.error((await res.json()).error || "Failed");
  }

  return (
    <Badge variant={pending ? "outline" : "secondary"}
      className={`gap-1.5 ${pending ? "border-amber-400/40 text-amber-300" : ""}`}>
      {account?.name ? <span>{account.name}</span> : null}
      <span className={account?.name ? "text-muted-foreground" : ""}>{email}</span>
      {pending && (
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide">
          <Clock className="h-3 w-3" /> Pending
        </span>
      )}
      {pending && (
        <button type="button" disabled={busy} title="Re-send invite"
          className="hover:text-foreground disabled:opacity-50" onClick={resend}>
          <RotateCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
        </button>
      )}
      <button type="button" disabled={busy} title="Remove PIC"
        className="hover:text-foreground disabled:opacity-50" onClick={remove}>
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

// Unified add-PIC panel: search existing accounts (by name or email) OR invite a
// brand-new email, then tick the divisions they cover and submit once.
function AddPic({ divisions, users, pics, onDone }: {
  divisions: { id: number; name: string }[];
  users: UserAccount[];
  pics: Record<number, Pic[]>;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ email: string; name: string | null; isNew: boolean } | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = q
    ? users.filter((u) => u.email.includes(q) || (u.name?.toLowerCase().includes(q) ?? false)).slice(0, 8)
    : [];
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
  const exactExists = users.some((u) => u.email === q);
  const canInvite = looksLikeEmail && !exactExists;

  function toggle(id: number) {
    setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function reset() { setTarget(null); setQuery(""); setSel([]); }

  async function submit() {
    if (!target || sel.length === 0) return;
    setBusy(true);
    try {
      if (target.isNew) {
        const res = await fetch("/api/eventid/pics/invite", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: target.email, division_ids: sel }),
        });
        const j = await res.json();
        if (!res.ok) { toast.error(j.error); return; }
        toast.success(j.alreadyExists ? "Existing user assigned" : `Invite sent to ${target.email}`);
      } else {
        // Assign existing account to each chosen division (no email sent).
        for (const division_id of sel) {
          const res = await fetch("/api/eventid/pics", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ division_id, email: target.email }),
          });
          if (!res.ok) { toast.error((await res.json()).error); return; }
        }
        toast.success(`${target.name ?? target.email} assigned`);
      }
      reset();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Add PIC</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!target ? (
          <Command shouldFilter={false} className="rounded-lg border">
            <CommandInput value={query} onValueChange={setQuery}
              placeholder="Search people by name or email…" />
            <CommandList>
              {matches.length === 0 && !canInvite && (
                <CommandEmpty>{q ? "No matching users. Type a full email to invite." : "Search people by name or email."}</CommandEmpty>
              )}
              {matches.length > 0 && (
                <CommandGroup heading="Existing users">
                  {matches.map((u) => (
                    <CommandItem key={u.email} value={u.email}
                      onSelect={() => { setTarget({ email: u.email, name: u.name, isNew: false }); }}>
                      <UserPlus className="h-4 w-4" />
                      <span className="flex-1">
                        {u.name ? <span className="font-medium">{u.name} </span> : null}
                        <span className="text-muted-foreground">{u.email}</span>
                      </span>
                      {!u.confirmed && <span className="text-[10px] uppercase text-amber-400">Pending</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {canInvite && (
                <CommandGroup heading="Invite new">
                  <CommandItem value={`invite-${q}`}
                    onSelect={() => { setTarget({ email: q, name: null, isNew: true }); }}>
                    <MailPlus className="h-4 w-4" />
                    <span>Invite <span className="font-medium">{q}</span> as a new PIC</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {target.isNew
                ? <Badge variant="outline" className="gap-1 border-amber-400/40 text-amber-300"><MailPlus className="h-3 w-3" /> New invite</Badge>
                : <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Existing</Badge>}
              <span className="font-medium">{target.name ?? target.email}</span>
              {target.name && <span className="text-muted-foreground">{target.email}</span>}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>Change</Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Divisions to assign</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {divisions.map((d) => {
                  const already = (pics[d.id] ?? []).some((p) => p.email === target.email);
                  return (
                    <label key={d.id} className={`flex items-center gap-1.5 text-sm ${already ? "opacity-50" : ""}`}>
                      <Checkbox checked={already || sel.includes(d.id)} disabled={already}
                        onCheckedChange={() => toggle(d.id)} />
                      {d.name}{already && <span className="text-xs text-muted-foreground">(assigned)</span>}
                    </label>
                  );
                })}
                {divisions.length === 0 && <span className="text-sm text-muted-foreground">Create a division first.</span>}
              </div>
            </div>
            <Button disabled={busy || sel.length === 0} onClick={submit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : target.isNew ? <Mail className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {target.isNew ? "Send invite & assign" : "Assign PIC"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BannerUploader({ event, onChanged }: { event: EventRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function upload(file: File | null) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", String(event.id));
    fd.set("file", file);
    const res = await fetch("/api/eventid/events/banner", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) { toast.success("Banner updated"); onChanged(); }
    else toast.error((await res.json().catch(() => ({}))).error || "Upload failed");
  }

  async function remove() {
    setBusy(true);
    const res = await fetch("/api/eventid/events/banner", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id }),
    });
    setBusy(false);
    if (res.ok) { toast.success("Banner removed"); onChanged(); }
    else toast.error((await res.json().catch(() => ({}))).error || "Failed");
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Event banner</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label className="group relative block w-full max-w-md cursor-pointer overflow-hidden rounded-lg">
          {event.banner_url ? (
            <EventBanner url={event.banner_url} name={event.name} rounded="rounded-lg" />
          ) : (
            <span className="flex aspect-2/1 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-input text-muted-foreground transition-colors group-hover:border-ring group-hover:bg-muted/40">
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs font-medium">Upload banner</span>
              <span className="text-[10px] text-muted-foreground/70">1200×600 recommended</span>
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
          <input type="file" accept="image/*" className="sr-only" disabled={busy}
            onChange={(e) => upload(e.target.files?.[0] ?? null)} />
        </label>
        {event.banner_url && (
          <Button variant="outline" size="sm" disabled={busy} onClick={remove}>
            <Trash2 className="h-4 w-4" /> Remove banner
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsForm({ event, onSaved }: { event: EventRow; onSaved: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState(event.name);
  const [slug, setSlug] = useState(event.slug);
  const [desc, setDesc] = useState(event.description ?? "");
  const [starts, setStarts] = useState(event.starts_on ?? "");
  const [ends, setEnds] = useState(event.ends_on ?? "");
  return (
    <Card><CardHeader><CardTitle className="text-base">Event settings</CardTitle></CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-2"><Label>Slug (URL)</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="grid gap-2"><Label>Description</Label>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" rows={3} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2"><Label>Starts</Label><Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Ends</Label><Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
        </div>
        <Button onClick={async () => {
          const slugChanged = slug !== event.slug;
          await onSaved({ name, slug, description: desc, starts_on: starts || null, ends_on: ends || null });
          if (slugChanged) window.location.href = `/eventid/e/${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
        }}>Save</Button>
      </CardContent></Card>
  );
}
