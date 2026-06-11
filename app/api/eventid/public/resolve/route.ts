import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { bannerPublicUrl } from "@/lib/eventid-banner";

// GET ?event=slug[&division=slug] : resolve public scope. Service-role, no auth.
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const eventSlug = p.get("event");
  const divisionSlug = p.get("division");
  if (!eventSlug) return NextResponse.json({ error: "Missing event" }, { status: 400 });

  const service = createAdminClient();
  const { data: event } = await service
    .from("eventid_events")
    .select("id, name, slug, description, starts_on, ends_on, is_open, banner_path, eventid_divisions(id, name, slug)")
    .eq("slug", eventSlug)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const divisions = (event.eventid_divisions as unknown as { id: number; name: string; slug: string }[]) ?? [];
  const bannerUrl = bannerPublicUrl(event.banner_path);
  const details = {
    description: event.description,
    startsOn: event.starts_on,
    endsOn: event.ends_on,
  };

  if (divisionSlug) {
    const div = divisions.find((d) => d.slug === divisionSlug);
    if (!div) return NextResponse.json({ error: "Invalid division" }, { status: 404 });
    return NextResponse.json({
      kind: "division",
      eventName: event.name,
      isOpen: event.is_open,
      bannerUrl,
      ...details,
      lockedDivision: { id: div.id, name: div.name },
    });
  }

  return NextResponse.json({
    kind: "event",
    eventName: event.name,
    isOpen: event.is_open,
    bannerUrl,
    ...details,
    openDivisions: divisions
      .map((d) => ({ id: d.id, name: d.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
