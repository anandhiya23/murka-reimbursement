import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { bannerPublicUrl } from "@/lib/eventid-banner";

// Returns the caller's EventID role + (for PICs) their assigned divisions.
export async function GET() {
  const { supabase, isAdmin, isPic, divisionIds, email } = await getEventidAccess();
  if (!isAdmin && !isPic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let divisions: {
    id: number; name: string; slug: string; event_id: number;
    event_name: string; event_slug: string; event_banner_url: string | null;
  }[] = [];
  if (divisionIds.length) {
    const { data } = await supabase
      .from("eventid_divisions")
      .select("id, name, slug, event_id, eventid_events(name, slug, banner_path)")
      .in("id", divisionIds);
    divisions = (data ?? []).map((d) => {
      const ev = d.eventid_events as unknown as { name: string; slug: string; banner_path: string | null };
      return {
        id: d.id, name: d.name, slug: d.slug, event_id: d.event_id,
        event_name: ev?.name ?? "", event_slug: ev?.slug ?? "",
        event_banner_url: bannerPublicUrl(ev?.banner_path ?? null),
      };
    });
  }

  return NextResponse.json({ email, isAdmin, isPic, divisions });
}
