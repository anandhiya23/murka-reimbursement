"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Scope {
  kind: "event" | "division";
  eventName: string;
  isOpen: boolean;
  lockedDivision?: { id: number; name: string };
  openDivisions?: { id: number; name: string }[];
}

export default function ApplyForm({ eventSlug, divisionSlug }: { eventSlug: string; divisionSlug?: string }) {
  const [scope, setScope] = useState<Scope | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams({ event: eventSlug });
    if (divisionSlug) qs.set("division", divisionSlug);
    fetch(`/api/eventid/public/resolve?${qs}`)
      .then(async (res) => {
        if (!res.ok) return setInvalid(true);
        setScope(await res.json());
      })
      .catch(() => setInvalid(true));
  }, [eventSlug, divisionSlug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !photo || !idPhoto) return setError("Name, photo and ID photo are required.");
    if (scope?.kind === "event" && !divisionId) return setError("Please choose a division.");
    setSubmitting(true);
    const fd = new FormData();
    fd.set("event_slug", eventSlug);
    if (divisionSlug) fd.set("division_slug", divisionSlug);
    if (divisionId) fd.set("division_id", divisionId);
    fd.set("full_name", name);
    fd.set("photo", photo);
    fd.set("id_photo", idPhoto);
    const res = await fetch("/api/eventid/public/submit", { method: "POST", body: fd });
    if (res.ok) setDone(true);
    else setError((await res.json().catch(() => ({}))).error || "Submission failed.");
    setSubmitting(false);
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-dvh flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );

  if (invalid) return (
    <Shell><CardHeader><CardTitle>Invalid link</CardTitle>
      <CardDescription>This application link is not valid.</CardDescription></CardHeader></Shell>
  );
  if (!scope) return (
    <Shell><CardContent className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Shell>
  );
  if (done) return (
    <Shell><CardHeader>
      <CheckCircle2 className="h-8 w-8 text-green-600" />
      <CardTitle>Submitted</CardTitle>
      <CardDescription>Your ID request for {scope.eventName} has been received.</CardDescription>
    </CardHeader></Shell>
  );
  if (!scope.isOpen) return (
    <Shell><CardHeader><CardTitle>{scope.eventName}</CardTitle>
      <CardDescription>This event is not currently accepting submissions.</CardDescription></CardHeader></Shell>
  );

  return (
    <Shell>
      <CardHeader>
        <CardTitle>ID Request — {scope.eventName}</CardTitle>
        <CardDescription>
          {scope.kind === "division" ? `Division: ${scope.lockedDivision?.name}` : "Fill in your details below."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
          </div>

          {scope.kind === "event" && (
            <div className="grid gap-2">
              <Label>Division</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger><SelectValue placeholder="Select a division" /></SelectTrigger>
                <SelectContent>
                  {scope.openDivisions?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="photo">Photo (portrait)</Label>
            <Input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="idphoto">Identification photo</Label>
            <Input id="idphoto" type="file" accept="image/*" onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)} required />
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {error}</p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </form>
      </CardContent>
    </Shell>
  );
}
