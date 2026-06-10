import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "event"
  );
}

// GET: list events (admin) with member/applicant counts.
export async function GET() {
  const { supabase, isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("eventid_events")
    .select("id, name, slug, description, starts_on, ends_on, is_open, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: create an event (auto slug, unique-suffixed).
export async function POST(request: Request) {
  const { isAdmin, email } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, starts_on, ends_on } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const service = createAdminClient();
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const { data: clash } = await service
      .from("eventid_events").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await service
    .from("eventid_events")
    .insert({
      name: name.trim(), slug,
      description: description?.trim() || null,
      starts_on: starts_on || null, ends_on: ends_on || null,
      created_by: email,
    })
    .select("id, slug")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK", id: data.id, slug: data.slug });
}

// PATCH: edit fields, slug, or toggle open/close.
export async function PATCH(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { id, action } = body as { id: number; action?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createAdminClient();
  const patch: Record<string, unknown> = {};

  if (action === "toggle_open") {
    patch.is_open = !!body.is_open;
  } else {
    const { name, description, starts_on, ends_on, slug } = body;
    if (name !== undefined) patch.name = String(name).trim();
    if (description !== undefined) patch.description = description?.trim() || null;
    if (starts_on !== undefined) patch.starts_on = starts_on || null;
    if (ends_on !== undefined) patch.ends_on = ends_on || null;
    if (slug !== undefined) {
      const wanted = slugify(String(slug));
      const { data: clash } = await service
        .from("eventid_events").select("id").eq("slug", wanted).neq("id", id).maybeSingle();
      if (clash) return NextResponse.json({ error: "Slug already in use" }, { status: 400 });
      patch.slug = wanted;
    }
  }

  const { error } = await service.from("eventid_events").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}
