import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";

// Returns the caller's EventID role + (for PICs) their assigned divisions.
export async function GET() {
  const { supabase, isAdmin, isPic, divisionIds, email } = await getEventidAccess();
  if (!isAdmin && !isPic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let divisions: { id: number; name: string; event_id: number; event_name: string }[] = [];
  if (divisionIds.length) {
    const { data } = await supabase
      .from("eventid_divisions")
      .select("id, name, event_id, eventid_events(name)")
      .in("id", divisionIds);
    divisions = (data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      event_id: d.event_id,
      event_name: (d.eventid_events as unknown as { name: string })?.name ?? "",
    }));
  }

  return NextResponse.json({ email, isAdmin, isPic, divisions });
}
