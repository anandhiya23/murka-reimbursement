"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle, ImageUp, IdCard, CalendarDays } from "lucide-react";
import { formatDate } from "@/lib/format";
import EventBanner from "@/app/components/eventid/EventBanner";

interface Scope {
  kind: "event" | "division";
  eventName: string;
  isOpen: boolean;
  bannerUrl?: string | null;
  description?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  lockedDivision?: { id: number; name: string };
  openDivisions?: { id: number; name: string }[];
}

export default function ApplyForm({ eventSlug, divisionSlug }: { eventSlug: string; divisionSlug?: string }) {
  const resolveKey = (() => {
    const qs = new URLSearchParams({ event: eventSlug });
    if (divisionSlug) qs.set("division", divisionSlug);
    return `/api/eventid/public/resolve?${qs}`;
  })();
  const { data: scope, error } = useSWR<Scope>(resolveKey);
  const invalid = !!error;

  const [name, setName] = useState("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [submitError, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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

  if (invalid)
    return (
      <Shell scope={scope}>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>This application link is not valid.</CardDescription>
        </CardHeader>
      </Shell>
    );
  if (!scope)
    return (
      <Shell scope={scope}>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Shell>
    );
  if (done)
    return (
      <Shell scope={scope}>
        <CardHeader className="flex-1 content-center justify-items-center text-center">
          <CheckCircle2 className="h-8 w-8 text-primary" />
          <CardTitle>Submitted</CardTitle>
          <CardDescription>Your ID request for {scope.eventName} has been received.</CardDescription>
        </CardHeader>
      </Shell>
    );
  if (!scope.isOpen)
    return (
      <Shell scope={scope}>
        <CardHeader className="flex-1 content-center justify-items-center text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <CardTitle>{scope.eventName}</CardTitle>
          <CardDescription>This event is not currently accepting submissions.</CardDescription>
        </CardHeader>
      </Shell>
    );

  return (
    <Shell scope={scope}>
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
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                  {scope.openDivisions?.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FileField id="photo" icon={<ImageUp className="h-4 w-4" />} label="Portrait" file={photo} onPick={setPhoto} />
            <FileField id="idphoto" icon={<IdCard className="h-4 w-4" />} label="ID photo" file={idPhoto} onPick={setIdPhoto} />
          </div>

          {submitError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {submitError}
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </form>
      </CardContent>
    </Shell>
  );
}

// Page chrome: banner + event details on the left, form card on the right.
// Hoisted to module scope so it keeps a stable identity across renders —
// defining it inside ApplyForm remounted the form (and dropped input focus)
// on every keystroke.
function Shell({ scope, children }: { scope?: Scope; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 md:p-6">
      <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
        {/* Left: event banner + details */}
        <div className="flex h-full flex-col gap-4">
          <EventBanner url={scope?.bannerUrl} name={scope?.eventName} className="shrink-0" />
          <Card className="flex flex-1 flex-col">
            {scope ? (
              <>
                <CardHeader>
                  <CardTitle className="text-xl">{scope.eventName}</CardTitle>
                  {(scope.startsOn || scope.endsOn) && (
                    <CardDescription className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {scope.startsOn ? formatDate(scope.startsOn) : ""}
                      {scope.endsOn && scope.endsOn !== scope.startsOn ? ` – ${formatDate(scope.endsOn)}` : ""}
                    </CardDescription>
                  )}
                </CardHeader>
                {scope.description && (
                  <CardContent className="whitespace-pre-line text-sm text-muted-foreground">
                    {scope.description}
                  </CardContent>
                )}
              </>
            ) : (
              <CardContent className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
                Loading…
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right: application form */}
        <Card className="w-full">{children}</Card>
      </div>
    </div>
  );
}

// Compact file picker with a portrait preview; falls back to an icon prompt.
function FileField({
  id,
  icon,
  label,
  file,
  onPick,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  file: File | null;
  onPick: (f: File | null) => void;
}) {
  // Object URL is derived from the file once and revoked on change — creating it
  // inline on every render would mint a new blob URL each keystroke, reloading
  // the preview (a network hit) and leaking the old URLs.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <label
      htmlFor={id}
      className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-input text-center transition-colors hover:border-ring hover:bg-muted/40"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <span className="text-muted-foreground transition-colors group-hover:text-foreground">{icon}</span>
          <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground/70">tap to upload</span>
        </>
      )}
      {url && (
        <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide text-background">
          {label}
        </span>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        required
      />
    </label>
  );
}
