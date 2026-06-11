"use client";

import { useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import EventidHeader from "@/app/components/EventidHeader";
import MembersPanel from "@/app/components/eventid/MembersPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface DivInfo { id: number; name: string; slug: string; event_id: number; event_slug: string }

export default function DivisionPage() {
  const { divisionId } = useParams();
  const id = Number(divisionId);
  const { data, error, isLoading } = useSWR<DivInfo[]>("/api/eventid/divisions");
  const div = (data ?? []).find((d) => d.id === id) ?? null;
  const notFound = !!data && !div;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Route returns 403 for non-admins -> bounce to the dashboard.
  useEffect(() => { if (error) window.location.href = "/eventid"; }, [error]);

  if (notFound) return (<><EventidHeader /><div className="p-8 text-muted-foreground">Division not found.</div></>);
  if (isLoading || !div) return (
    <>
      <EventidHeader />
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </>
  );

  const link = `${origin}/e/${div.event_slug}/${div.slug}`;

  return (
    <>
      <EventidHeader subtitle={div.name} />
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/eventid" className="text-sm text-muted-foreground hover:underline">← Back</Link>
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
