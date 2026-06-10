import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// GET ?token= : resolve a public link to its event/division scope.
// Service-role, unauthenticated. Returns only non-sensitive scope info.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const service = createAdminClient();

  // Division-level token first (locks the form to one division).
  const { data: division } = await service
    .from("eventid_divisions")
    .select("id, name, event_id, eventid_events(id, name, is_open)")
    .eq("public_token", token)
    .maybeSingle();

  if (division) {
    const ev = division.eventid_events as unknown as { id: number; name: string; is_open: boolean };
    return NextResponse.json({
      kind: "division",
      eventId: ev.id,
      eventName: ev.name,
      isOpen: ev.is_open,
      lockedDivision: { id: division.id, name: division.name },
    });
  }

  // Event-level token: applicant picks from the event's divisions.
  const { data: event } = await service
    .from("eventid_events")
    .select("id, name, is_open, eventid_divisions(id, name)")
    .eq("public_token", token)
    .maybeSingle();

  if (event) {
    const divisions = (event.eventid_divisions as unknown as { id: number; name: string }[]) ?? [];
    return NextResponse.json({
      kind: "event",
      eventId: event.id,
      eventName: event.name,
      isOpen: event.is_open,
      openDivisions: divisions.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return NextResponse.json({ error: "Invalid link" }, { status: 404 });
}
