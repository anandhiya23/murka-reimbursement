"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import EventidHeader from "@/app/components/EventidHeader";
import MembersPanel from "@/app/components/eventid/MembersPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface DivInfo { id: number; name: string; slug: string; event_id: number; event_slug: string }

export default function DivisionPage() {
  const { divisionId } = useParams();
  const id = Number(divisionId);
  const [div, setDiv] = useState<DivInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    const res = await fetch("/api/eventid/divisions");
    if (res.status === 403) { window.location.href = "/eventid"; return; }
    const divs: DivInfo[] = await res.json();
    const found = (divs ?? []).find((d) => d.id === id) ?? null;
    if (!found) setNotFound(true); else setDiv(found);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (notFound) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Division not found.</div></>);
  if (!div) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Loading…</div></>);

  const link = `${origin}/e/${div.event_slug}/${div.slug}`;

  return (
    <>
      <EventidHeader subtitle={div.name} />
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <a href="/eventid" className="text-sm text-muted-foreground hover:underline">← Back</a>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Public link copied"); }}>
            <Copy className="h-4 w-4" /> Public link
          </Button>
        </div>
        <MembersPanel eventId={div.event_id} divisionId={div.id} eventSlug={div.event_slug}
          divisions={[{ id: div.id, name: div.name }]} canManage />
      </div>
    </>
  );
}
