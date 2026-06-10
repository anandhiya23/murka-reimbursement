"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, Trash2, Plus, Printer, Eye, Loader2 } from "lucide-react";

export interface MemberRow {
  id: number; event_id: number; division_id: number; full_name: string;
  member_no: string | null; position: string | null; status: string; source: string;
  photo_url: string | null; id_photo_url: string | null; printed_at: string | null;
}
interface DivisionLite { id: number; name: string }

type StatusFilter = "all" | "applicant" | "member" | "rejected";
const STATUS_COLOR: Record<string, string> = {
  applicant: "bg-amber-100 text-amber-800 border-amber-200",
  member: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export default function MembersPanel({
  eventId, divisionId, eventSlug, divisions, canManage, enablePrint,
}: {
  eventId?: number; divisionId?: number; eventSlug?: string;
  divisions: DivisionLite[]; canManage: boolean; enablePrint?: boolean;
}) {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<MemberRow | null>(null);
  const [printing, setPrinting] = useState(false);

  // add-member form
  const [addOpen, setAddOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aPos, setAPos] = useState("");
  const [aDiv, setADiv] = useState<string>(divisionId ? String(divisionId) : "");
  const [aPhoto, setAPhoto] = useState<File | null>(null);
  const [aId, setAId] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (eventId) qs.set("eventId", String(eventId));
    if (divisionId) qs.set("divisionId", String(divisionId));
    const res = await fetch(`/api/eventid/members?${qs}`);
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [eventId, divisionId]);
  useEffect(() => { load(); }, [load]);

  async function act(id: number, action: "verify" | "reject", message?: string) {
    const res = await fetch("/api/eventid/members", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    if (res.ok) { toast.success(action === "verify" ? "Verified — now a member" : "Rejected"); await load(); }
    else toast.error((await res.json()).error || "Failed");
  }
  async function del(id: number) {
    const res = await fetch("/api/eventid/members", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    if (res.ok) { toast.success("Deleted"); await load(); } else toast.error("Failed");
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
    if (aPos) fd.set("position", aPos);
    if (aPhoto) fd.set("photo", aPhoto);
    if (aId) fd.set("id_photo", aId);
    const res = await fetch("/api/eventid/members", { method: "POST", body: fd });
    if (res.ok) {
      toast.success("Member added");
      setAddOpen(false); setAName(""); setAPos(""); setAPhoto(null); setAId(null);
      await load();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "applicant", "member", "rejected"] as StatusFilter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)} ({counts[f]})
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          {enablePrint && (
            <>
              {selectedMembers.length > 0 && (
                <Button size="sm" variant="outline" disabled={printing} onClick={() => print(selectedMembers)}>
                  <Printer className="h-4 w-4" /> Print Selected ({selectedMembers.length})
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={printing} onClick={() => print()}>
                {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Print Members ({counts.member})
              </Button>
            </>
          )}
          {canManage && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> Add Member</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add member</DialogTitle></DialogHeader>
                <form onSubmit={addMember} className="grid gap-3">
                  <div className="grid gap-2"><Label>Full name</Label>
                    <Input value={aName} onChange={(e) => setAName(e.target.value)} required /></div>
                  <div className="grid gap-2"><Label>Position (optional)</Label>
                    <Input value={aPos} onChange={(e) => setAPos(e.target.value)} /></div>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {enablePrint && <TableHead className="w-8" />}
              <TableHead>Name</TableHead>
              {!divisionId && <TableHead>Division</TableHead>}
              <TableHead>No.</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No members.</TableCell></TableRow>
            ) : visible.map((r) => (
              <TableRow key={r.id}>
                {enablePrint && (
                  <TableCell>
                    {r.status === "member" && (
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => setSelected((p) => {
                        const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n;
                      })} />
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {r.photo_url ? <img src={r.photo_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                    <div>{r.full_name}{r.position && <div className="text-xs text-muted-foreground">{r.position}</div>}</div>
                  </div>
                </TableCell>
                {!divisionId && <TableCell>{divName(r.division_id)}</TableCell>}
                <TableCell className="font-mono text-sm">{r.member_no ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COLOR[r.status]}>{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></Button>
                    {canManage && r.status !== "member" && (
                      <Button size="icon" variant="ghost" onClick={() => act(r.id, "verify")} title="Verify"><Check className="h-4 w-4 text-green-600" /></Button>
                    )}
                    {canManage && r.status !== "rejected" && (
                      <Button size="icon" variant="ghost" onClick={() => act(r.id, "reject", prompt("Reason (optional):") ?? undefined)} title="Reject"><X className="h-4 w-4 text-red-600" /></Button>
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{detail?.full_name}</SheetTitle></SheetHeader>
          {detail && (
            <div className="px-4 space-y-3">
              <div className="text-sm text-muted-foreground">
                {divName(detail.division_id)} · {detail.member_no ? `No. ${detail.member_no}` : "no number"} · {detail.source}
              </div>
              <Badge variant="outline" className={STATUS_COLOR[detail.status]}>{detail.status}</Badge>
              {detail.photo_url && <div><div className="text-xs text-muted-foreground mb-1">Portrait</div><img src={detail.photo_url} alt="" className="rounded-md max-h-64" /></div>}
              {detail.id_photo_url && <div><div className="text-xs text-muted-foreground mb-1">ID photo</div><img src={detail.id_photo_url} alt="" className="rounded-md max-h-64" /></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
