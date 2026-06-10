import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateToken } from "@/lib/token";

// GET ?eventId= : divisions for an event. Admin sees all; PIC sees only theirs.
export async function GET(request: Request) {
  const { supabase, isAdmin, isPic, divisionIds } = await getEventidAccess();
  if (!isAdmin && !isPic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const eventId = new URL(request.url).searchParams.get("eventId");

  let q = supabase
    .from("eventid_divisions")
    .select("id, event_id, name, public_token, created_at")
    .order("name");
  if (eventId) q = q.eq("event_id", Number(eventId));
  if (!isAdmin) q = q.in("id", divisionIds.length ? divisionIds : [-1]);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: create a division under an event (admin).
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { event_id, name } = await request.json();
  if (!event_id || !name?.trim()) {
    return NextResponse.json({ error: "event_id and name required" }, { status: 400 });
  }
  const service = createAdminClient();
  const { data, error } = await service
    .from("eventid_divisions")
    .insert({ event_id, name: name.trim() })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK", id: data.id });
}

// PATCH: rename or generate token. Admin any; PIC only own divisions.
export async function PATCH(request: Request) {
  const { isAdmin, isPic, divisionIds } = await getEventidAccess();
  const body = await request.json();
  const { id, action, name } = body as { id: number; action?: string; name?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = isAdmin || (isPic && divisionIds.includes(id));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createAdminClient();
  let patch: Record<string, unknown> = {};
  if (action === "generate_token") patch = { public_token: generateToken() };
  else if (name !== undefined) patch = { name: String(name).trim() };

  const { error } = await service.from("eventid_divisions").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

// DELETE: remove a division (admin). Cascades pics + requests.
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
