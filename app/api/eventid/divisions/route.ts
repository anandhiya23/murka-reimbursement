import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "division";
}

// GET ?eventId= : divisions for an event (admin all; PIC own). Includes slug + event slug.
export async function GET(request: Request) {
  const { supabase, isAdmin, isPic, divisionIds } = await getEventidAccess();
  if (!isAdmin && !isPic) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const eventId = new URL(request.url).searchParams.get("eventId");

  let q = supabase
    .from("eventid_divisions")
    .select("id, event_id, name, slug, created_at, eventid_events(slug)")
    .order("name");
  if (eventId) q = q.eq("event_id", Number(eventId));
  if (!isAdmin) q = q.in("id", divisionIds.length ? divisionIds : [-1]);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data ?? []).map((d) => ({
    id: d.id, event_id: d.event_id, name: d.name, slug: d.slug,
    event_slug: (d.eventid_events as unknown as { slug: string })?.slug ?? null,
  }));
  return NextResponse.json(rows);
}

// POST: create a division (auto slug, unique within event).
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { event_id, name } = await request.json();
  if (!event_id || !name?.trim()) {
    return NextResponse.json({ error: "event_id and name required" }, { status: 400 });
  }
  const service = createAdminClient();
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const { data: clash } = await service
      .from("eventid_divisions").select("id").eq("event_id", event_id).eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }
  const { data, error } = await service
    .from("eventid_divisions")
    .insert({ event_id, name: name.trim(), slug })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK", id: data.id });
}

// PATCH: rename division. Admin any; PIC own.
export async function PATCH(request: Request) {
  const { isAdmin, isPic, divisionIds } = await getEventidAccess();
  const body = await request.json();
  const { id, name } = body as { id: number; name?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!(isAdmin || (isPic && divisionIds.includes(id)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const service = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = String(name).trim();
  const { error } = await service.from("eventid_divisions").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

// DELETE: remove a division (admin).
export async function DELETE(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const service = createAdminClient();
  const { error } = await service.from("eventid_divisions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}
