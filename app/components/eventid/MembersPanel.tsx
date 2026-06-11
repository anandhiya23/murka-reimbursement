"use client";

import { useState } from "react";
import useSWR from "swr";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, Trash2, Plus, Printer, Loader2 } from "lucide-react";

export interface MemberRow {
  id: number; event_id: number; division_id: number; full_name: string;
  member_no: string | null; position: string | null; status: string; source: string;
  photo_url: string | null; id_photo_url: string | null; printed_at: string | null;
}
interface DivisionLite { id: number; name: string }

type StatusFilter = "all" | "applicant" | "member" | "rejected";
const STATUS_COLOR: Record<string, string> = {
  applicant: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  member: "border-primary/40 bg-primary/15 text-primary",
  rejected: "border-destructive/40 bg-destructive/10 text-red-400",
};

export default function MembersPanel({
  eventId, divisionId, eventSlug, divisions, canManage, enablePrint,
}: {
  eventId?: number; divisionId?: number; eventSlug?: string;
  divisions: DivisionLite[]; canManage: boolean; enablePrint?: boolean;
}) {
  const membersKey = (() => {
    const qs = new URLSearchParams();
    if (eventId) qs.set("eventId", String(eventId));
    if (divisionId) qs.set("divisionId", String(divisionId));
    return `/api/eventid/members?${qs}`;
  })();
  const { data, isLoading, mutate } = useSWR<MemberRow[]>(membersKey);
  const rows = Array.isArray(data) ? data : [];
  const loading = isLoading;

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<MemberRow | null>(null);
  const [printing, setPrinting] = useState(false);

  // Reject-reason prompt (replaces native prompt()). Single row or bulk.
  const [rejectTarget, setRejectTarget] = useState<{ kind: "single"; id: number } | { kind: "bulk" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // add-member form
  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aDiv, setADiv] = useState<string>(divisionId ? String(divisionId) : "");
  const [aPhoto, setAPhoto] = useState<File | null>(null);
  const [aId, setAId] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function act(id: number, action: "verify" | "reject", message?: string) {
    const res = await fetch("/api/eventid/members", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    if (res.ok) { toast.success(action === "verify" ? "Verified — now a member" : "Rejected"); await mutate(); }
    else toast.error((await res.json()).error || "Failed");
  }
  async function del(id: number) {
    const res = await fetch("/api/eventid/members", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success("Deleted"); await mutate(); } else toast.error("Failed");
  }

  // Bulk verify/reject over the current selection (skips rows the action can't apply to).
  async function bulkAct(action: "verify" | "reject", message?: string) {
    const ids = [...selected].filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r && (action === "verify" ? r.status !== "member" : r.status !== "rejected");
    });
    if (!ids.length) { toast.error("No applicable rows selected"); return; }
    await Promise.all(ids.map((id) => fetch("/api/eventid/members", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, message }),
    })));
    toast.success(`${ids.length} ${action === "verify" ? "verified" : "rejected"}`);
    setSelected(new Set()); await mutate();
  }

  // Resolves the reject-reason dialog for either a single row or the selection.
  async function confirmReject() {
    const message = rejectReason.trim() || undefined;
    const target = rejectTarget;
    setRejectTarget(null); setRejectReason("");
    if (target?.kind === "single") await act(target.id, "reject", message);
    else if (target?.kind === "bulk") await bulkAct("reject", message);
  }
  async function bulkDelete() {
    const ids = [...selected];
    await Promise.all(ids.map((id) => fetch("/api/eventid/members", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    })));
    toast.success(`${ids.length} deleted`);
    setSelected(new Set()); await mutate();
  }
  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const divId = divisionId ?? Number(aDiv);
    if (!aName.trim() || !divId || !eventId) { toast.error("Name and division required"); return; }
    setSaving(true);
    const fd = new FormData();
    fd.set("event_id", String(eventId));
    fd.set("division_id", String(divId));
    fd.set("full_name", aName);
    if (aPhoto) fd.set("photo", aPhoto);
    if (aId) fd.set("id_photo", aId);
    const res = await fetch("/api/eventid/members", { method: "POST", body: fd });
    if (res.ok) {
      toast.success("Member added");
      setAddOpen(false); setAName(""); setAPhoto(null); setAId(null);
      await mutate();
    } else toast.error((await res.json()).error || "Failed");
    setSaving(false);
  }

  async function print(ids?: number[]) {
    if (!eventId) return;
    setPrinting(true);
    try {
      const res = await fetch("/api/eventid/print", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, requestIds: ids }),
      });
      if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error || "Print failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "idcards.pdf"; a.click();
      URL.revokeObjectURL(url);
    } finally { setPrinting(false); }
  }

  const visible = rows.filter((r) => filter === "all" || r.status === filter);
  const divName = (id: number) => divisions.find((d) => d.id === id)?.name ?? "";
  const selectedMembers = [...selected].filter((id) => rows.some((r) => r.id === id && r.status === "member"));
  const counts = {
    all: rows.length,
    applicant: rows.filter((r) => r.status === "applicant").length,
    member: rows.filter((r) => r.status === "member").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  // Row selection drives bulk edit (manage) and print. Available whenever the
  // user can do either.
  const selectable = canManage || !!enablePrint;
  const colCount = 4 + (!divisionId ? 1 : 0) + (selectable ? 1 : 0);
  const toggleOne = (id: number) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAllVisible = () =>
    setSelected((p) => {
      const n = new Set(p);
      if (allVisibleSelected) visible.forEach((r) => n.delete(r.id));
      else visible.forEach((r) => n.add(r.id));
      return n;
    });

  // Shared between the desktop table and the mobile card list.
  const selectCheckbox = (r: MemberRow) =>
    selectable ? (
      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label="Select row" />
    ) : null;

  const rowActions = (r: MemberRow) => (
    <>
      {canManage && r.status !== "member" && (
        <Button size="icon" variant="ghost" onClick={() => act(r.id, "verify")} title="Verify"><Check className="h-4 w-4 text-green-600" /></Button>
      )}
      {canManage && r.status !== "rejected" && (
        <Button size="icon" variant="ghost" onClick={() => { setRejectReason(""); setRejectTarget({ kind: "single", id: r.id }); }} title="Reject"><X className="h-4 w-4 text-red-600" /></Button>
      )}
      {canManage && (
        <AlertDialog>
          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete {r.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>This removes the member and their photos. Cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del(r.id)}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );

  return (
    <>
    <Card>
      <CardContent className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "applicant", "member", "rejected"] as StatusFilter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)} ({counts[f]})
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          {enablePrint && filter === "member" && (
            <Button size="sm" variant="outline" disabled={printing} onClick={() => print()}>
              {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print All ({counts.member})
            </Button>
          )}
          {canManage && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add Member</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
                <form onSubmit={addMember} className="grid gap-3">
                  <div className="grid gap-2"><Label>Full name</Label>
                    <Input value={aName} onChange={(e) => setAName(e.target.value)} required /></div>
                  {!divisionId && (
                    <div className="grid gap-2"><Label>Division</Label>
                      <Select value={aDiv} onValueChange={setADiv}>
                        <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                        <SelectContent>{divisions.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                      </Select></div>
                  )}
                  <div className="grid gap-2"><Label>Photo (optional)</Label>
                    <Input type="file" accept="image/*" onChange={(e) => setAPhoto(e.target.files?.[0] ?? null)} /></div>
                  <div className="grid gap-2"><Label>ID photo (optional)</Label>
                    <Input type="file" accept="image/*" onChange={(e) => setAId(e.target.files?.[0] ?? null)} /></div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {enablePrint && selectedMembers.length > 0 && (
              <Button size="sm" variant="outline" disabled={printing} onClick={() => print(selectedMembers)}>
                <Printer className="h-4 w-4" /> Print ({selectedMembers.length})
              </Button>
            )}
            {canManage && (
              <>
                <Button size="sm" variant="outline" onClick={() => bulkAct("verify")}>
                  <Check className="h-4 w-4 text-green-600" /> Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setRejectReason(""); setRejectTarget({ kind: "bulk" }); }}>
                  <X className="h-4 w-4 text-red-600" /> Reject
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {selected.size} member{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
                      <AlertDialogDescription>Removes the selected members and their photos. Cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={bulkDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border/60">
        <Table className="min-w-140">
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-8">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Select all" />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              {!divisionId && <TableHead>Division</TableHead>}
              <TableHead>No.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [0, 1, 2, 3].map((i) => (
                <TableRow key={`sk-${i}`}>
                  {selectable && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-8 w-8 rounded" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  {!divisionId && <TableCell><Skeleton className="h-4 w-20" /></TableCell>}
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><div className="flex justify-end"><Skeleton className="h-7 w-20" /></div></TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">No members.</TableCell></TableRow>
            ) : visible.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" data-state={selected.has(r.id) ? "selected" : undefined} onClick={() => setDetail(r)}>
                {selectable && <TableCell onClick={(e) => e.stopPropagation()}>{selectCheckbox(r)}</TableCell>}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {r.photo_url ? <img src={r.photo_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                    <div>{r.full_name}{r.position && <div className="text-xs text-muted-foreground">{r.position}</div>}</div>
                  </div>
                </TableCell>
                {!divisionId && <TableCell>{divName(r.division_id)}</TableCell>}
                <TableCell className="font-mono text-sm text-primary">{r.member_no ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COLOR[r.status]}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>{rowActions(r)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              {detail?.photo_url ? (
                <img src={detail.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-full bg-muted" />
              )}
              <div className="min-w-0">
                <SheetTitle className="truncate">{detail?.full_name}</SheetTitle>
                <SheetDescription className="truncate">
                  {detail?.position || divName(detail?.division_id ?? -1) || "Member"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {detail && (
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
                {([
                  ["Status", <Badge key="s" variant="outline" className={STATUS_COLOR[detail.status]}>{detail.status}</Badge>],
                  ["Number", detail.member_no ? <span className="font-mono text-primary">{detail.member_no}</span> : <span className="text-muted-foreground">—</span>],
                  ["Division", divName(detail.division_id) || "—"],
                  ["Source", <span className="capitalize">{detail.source}</span>],
                ] as const).map(([k, v]) => (
                  <div key={k} className="bg-card p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-1 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              {(detail.photo_url || detail.id_photo_url) && (
                <div className="grid grid-cols-2 gap-3">
                  {detail.photo_url && (
                    <figure className="space-y-1.5">
                      <img src={detail.photo_url} alt="Portrait" className="aspect-square w-full rounded-lg border object-cover" />
                      <figcaption className="text-center text-xs text-muted-foreground">Portrait</figcaption>
                    </figure>
                  )}
                  {detail.id_photo_url && (
                    <figure className="space-y-1.5">
                      <img src={detail.id_photo_url} alt="ID" className="aspect-square w-full rounded-lg border object-cover" />
                      <figcaption className="text-center text-xs text-muted-foreground">ID photo</figcaption>
                    </figure>
                  )}
                </div>
              )}
            </div>
          )}

          {detail && canManage && (
            <SheetFooter className="flex-row gap-2 border-t p-4">
              {detail.status !== "member" && (
                <Button variant="outline" className="flex-1" onClick={() => { act(detail.id, "verify"); setDetail(null); }}>
                  <Check className="h-4 w-4 text-green-600" /> Verify
                </Button>
              )}
              {detail.status !== "rejected" && (
                <Button variant="outline" className="flex-1" onClick={() => { setRejectReason(""); setRejectTarget({ kind: "single", id: detail.id }); setDetail(null); }}>
                  <X className="h-4 w-4 text-red-600" /> Reject
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete {detail.full_name}?</AlertDialogTitle>
                    <AlertDialogDescription>This removes the member and their photos. Cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { del(detail.id); setDetail(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          )}
          {detail && !canManage && (
            <SheetFooter className="border-t p-4">
              <SheetClose asChild><Button variant="outline" className="w-full">Close</Button></SheetClose>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.kind === "bulk" ? `${selected.size} selected` : "member"}?</DialogTitle>
            <DialogDescription>Add an optional reason{rejectTarget?.kind === "bulk" ? " — applied to all" : ""}.</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
