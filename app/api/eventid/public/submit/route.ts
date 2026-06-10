import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { toJpeg } from "@/lib/to-jpeg";

const BUCKET = "eventid-photos";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB per file
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20; // best-effort: max submissions per token per minute

// POST (multipart): public ID-card application. Service-role, unauthenticated.
// Validates token + event-open + division scope server-side (never trust UI).
export async function POST(request: Request) {
  const form = await request.formData();
  const token = form.get("token") as string;
  const full_name = (form.get("full_name") as string)?.trim();
  const wantedDivision = Number(form.get("division_id")) || null;
  const photo = form.get("photo");
  const idPhoto = form.get("id_photo");

  if (!token || !full_name) {
    return NextResponse.json({ error: "Missing token or name" }, { status: 400 });
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

  // Resolve scope from token.
  let eventId: number;
  let divisionId: number;
  let isOpen: boolean;
  let submittedVia: "event" | "division";

  const { data: division } = await service
    .from("eventid_divisions")
    .select("id, event_id, eventid_events(id, is_open)")
    .eq("public_token", token)
    .maybeSingle();

  if (division) {
    const ev = division.eventid_events as unknown as { id: number; is_open: boolean };
    eventId = ev.id;
    divisionId = division.id; // locked
    isOpen = ev.is_open;
    submittedVia = "division";
  } else {
    const { data: event } = await service
      .from("eventid_events")
      .select("id, is_open")
      .eq("public_token", token)
      .maybeSingle();
    if (!event) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
    if (!wantedDivision) {
      return NextResponse.json({ error: "Please choose a division" }, { status: 400 });
    }
    // Confirm the chosen division belongs to this event.
    const { data: div } = await service
      .from("eventid_divisions")
      .select("id")
      .eq("id", wantedDivision)
      .eq("event_id", event.id)
      .maybeSingle();
    if (!div) return NextResponse.json({ error: "Invalid division" }, { status: 400 });
    eventId = event.id;
    divisionId = div.id;
    isOpen = event.is_open;
    submittedVia = "event";
  }

  if (!isOpen) {
    return NextResponse.json({ error: "This event is not accepting submissions." }, { status: 403 });
  }

  // Best-effort rate limit per token (durable-ish: counts recent rows).
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await service
    .from("eventid_requests")
    .select("id", { count: "exact", head: true })
    .eq("source_token", token)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) {
    return NextResponse.json({ error: "Too many submissions, try again shortly." }, { status: 429 });
  }

  // Upload both photos to the private bucket.
  const photoPath = await upload(service, photo, eventId, divisionId, "portrait");
  const idPath = await upload(service, idPhoto, eventId, divisionId, "id");

  const { error } = await service.from("eventid_requests").insert({
    event_id: eventId,
    division_id: divisionId,
    full_name,
    photo_path: photoPath,
    id_photo_path: idPath,
    status: "pending",
    submitted_via: submittedVia,
    source_token: token,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

async function upload(
  service: ReturnType<typeof createAdminClient>,
  file: File,
  eventId: number,
  divisionId: number,
  label: string
): Promise<string> {
  const jpeg = await toJpeg({ name: file.name, type: file.type, buffer: await file.arrayBuffer() });
  const safe = jpeg.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `eventid/${eventId}/${divisionId}/${Date.now()}-${label}-${safe}`;
  const { error } = await service.storage
    .from(BUCKET)
    .upload(path, jpeg.buffer, { contentType: jpeg.type, upsert: false });
  if (error) throw error;
  return path;
}
