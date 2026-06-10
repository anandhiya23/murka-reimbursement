import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { toJpeg } from "@/lib/to-jpeg";

const BUCKET = "eventid-photos";
const MAX_BYTES = 10 * 1024 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;

// POST (multipart): public application by slug. Service-role, unauthenticated.
// Validates event-open + division scope server-side. Creates a pending applicant.
export async function POST(request: Request) {
  const form = await request.formData();
  const eventSlug = form.get("event_slug") as string;
  const divisionSlug = (form.get("division_slug") as string) || null;
  const divisionId = Number(form.get("division_id")) || null;
  const full_name = (form.get("full_name") as string)?.trim();
  const photo = form.get("photo");
  const idPhoto = form.get("id_photo");

  if (!eventSlug || !full_name) {
    return NextResponse.json({ error: "Missing event or name" }, { status: 400 });
  }
  if (!(photo instanceof File) || !(idPhoto instanceof File) || !photo.size || !idPhoto.size) {
    return NextResponse.json({ error: "Both photos are required" }, { status: 400 });
  }
  if (photo.size > MAX_BYTES || idPhoto.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }
  for (const f of [photo, idPhoto]) {
    if (!f.type.startsWith("image/")) {
      return NextResponse.json({ error: "Files must be images" }, { status: 400 });
    }
  }

  const service = createAdminClient();
  const { data: event } = await service
    .from("eventid_events")
    .select("id, is_open")
    .eq("slug", eventSlug)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (!event.is_open) {
    return NextResponse.json({ error: "This event is not accepting submissions." }, { status: 403 });
  }

  // Resolve division: locked by slug, or chosen by id (must belong to event).
  let resolvedDivision: number;
  if (divisionSlug) {
    const { data: div } = await service
      .from("eventid_divisions").select("id").eq("event_id", event.id).eq("slug", divisionSlug).maybeSingle();
    if (!div) return NextResponse.json({ error: "Invalid division" }, { status: 404 });
    resolvedDivision = div.id;
  } else {
    if (!divisionId) return NextResponse.json({ error: "Please choose a division" }, { status: 400 });
    const { data: div } = await service
      .from("eventid_divisions").select("id").eq("event_id", event.id).eq("id", divisionId).maybeSingle();
    if (!div) return NextResponse.json({ error: "Invalid division" }, { status: 400 });
    resolvedDivision = div.id;
  }

  // Best-effort rate limit per event slug.
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await service
    .from("eventid_members")
    .select("id", { count: "exact", head: true })
    .eq("source_token", eventSlug)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) {
    return NextResponse.json({ error: "Too many submissions, try again shortly." }, { status: 429 });
  }

  const photoPath = await upload(service, photo, event.id, resolvedDivision, "portrait");
  const idPath = await upload(service, idPhoto, event.id, resolvedDivision, "id");

  const { error } = await service.from("eventid_members").insert({
    event_id: event.id,
    division_id: resolvedDivision,
    full_name,
    photo_path: photoPath,
    id_photo_path: idPath,
    status: "applicant",
    source: "public",
    submitted_via: divisionSlug ? "division" : "event",
    source_token: eventSlug,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

async function upload(
  service: ReturnType<typeof createAdminClient>,
  file: File, eventId: number, divisionId: number, label: string
): Promise<string> {
  const jpeg = await toJpeg({ name: file.name, type: file.type, buffer: await file.arrayBuffer() });
  const safe = jpeg.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `eventid/${eventId}/${divisionId}/${Date.now()}-${label}-${safe}`;
  const { error } = await service.storage.from(BUCKET).upload(path, jpeg.buffer, {
    contentType: jpeg.type, upsert: false,
  });
  if (error) throw error;
  return path;
}
