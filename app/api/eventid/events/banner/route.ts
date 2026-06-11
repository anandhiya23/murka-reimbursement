import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { BANNER_BUCKET, processBanner, bannerPublicUrl } from "@/lib/eventid-banner";

// POST (multipart: id, file): set/replace an event banner. Admin only.
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const id = Number(form.get("id"));
  const file = form.get("file");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const service = createAdminClient();
  const { data: ev } = await service
    .from("eventid_events").select("banner_path").eq("id", id).maybeSingle();
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await processBanner(file);
  } catch {
    return NextResponse.json({ error: "Unsupported or corrupt image" }, { status: 400 });
  }

  const path = `banners/${id}-${Date.now()}.jpg`;
  const { error: upErr } = await service.storage
    .from(BANNER_BUCKET).upload(path, buffer, { contentType: "image/jpeg", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { error } = await service
    .from("eventid_events").update({ banner_path: path }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Best-effort cleanup of the previous banner.
  if (ev.banner_path) await service.storage.from(BANNER_BUCKET).remove([ev.banner_path]);

  return NextResponse.json({ status: "OK", banner_url: bannerPublicUrl(path) });
}

// DELETE (json: id): remove an event banner. Admin only.
export async function DELETE(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const service = createAdminClient();
  const { data: ev } = await service
    .from("eventid_events").select("banner_path").eq("id", id).maybeSingle();
  if (ev?.banner_path) await service.storage.from(BANNER_BUCKET).remove([ev.banner_path]);

  const { error } = await service
    .from("eventid_events").update({ banner_path: null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}
