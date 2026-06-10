import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateToken } from "@/lib/token";

// GET: list all events (admin only).
export async function GET() {
  const { supabase, isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("eventid_events")
    .select("id, name, description, starts_on, ends_on, is_open, public_token, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: create an event.
export async function POST(request: Request) {
  const { isAdmin, email } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, starts_on, ends_on } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const service = createAdminClient();
  const { data, error } = await service
    .from("eventid_events")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      starts_on: starts_on || null,
      ends_on: ends_on || null,
      created_by: email,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK", id: data.id });
}

// PATCH: edit event, toggle open/close, or generate a public token.
export async function PATCH(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, action } = body as { id: number; action?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createAdminClient();
  let patch: Record<string, unknown> = {};

  if (action === "toggle_open") {
    patch = { is_open: !!body.is_open };
  } else if (action === "generate_token") {
    patch = { public_token: generateToken() };
  } else {
    // generic field edit
    const { name, description, starts_on, ends_on } = body;
    if (name !== undefined) patch.name = String(name).trim();
    if (description !== undefined) patch.description = description?.trim() || null;
    if (starts_on !== undefined) patch.starts_on = starts_on || null;
    if (ends_on !== undefined) patch.ends_on = ends_on || null;
  }

  const { error } = await service.from("eventid_events").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}
