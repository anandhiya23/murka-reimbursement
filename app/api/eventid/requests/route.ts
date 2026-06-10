import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { toJpeg } from "@/lib/to-jpeg";

const BUCKET = "eventid-photos";
const SIGNED_TTL = 60; // seconds

// Sign private-bucket paths for viewing. Never expose public URLs for ID scans.
async function signPaths(
  service: ReturnType<typeof createAdminClient>,
  rows: { photo_path: string | null; id_photo_path: string | null }[]
) {
  const paths = rows.flatMap((r) =>
    [r.photo_path, r.id_photo_path].filter((p): p is string => !!p)
  );
  if (!paths.length) return new Map<string, string>();
  const { data } = await service.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  const map = new Map<string, string>();
  (data ?? []).forEach((d) => {
    if (d.signedUrl && d.path) map.set(d.path, d.signedUrl);
  });
  return map;
}

// GET ?eventId= &divisionId= : requests, scoped. Admin all; PIC own divisions.
export async function GET(request: Request) {
  const { supabase, isAdmin, isPic, divisionIds } = await getEventidAccess();
  if (!isAdmin && !isPic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const eventId = params.get("eventId");
  const divisionId = params.get("divisionId");

  let q = supabase
    .from("eventid_requests")
    .select(
      "id, event_id, division_id, full_name, photo_path, id_photo_path, status, reviewed_by, reviewed_at, review_message, created_at"
    )
    .order("created_at", { ascending: false });

  if (eventId) q = q.eq("event_id", Number(eventId));
  if (divisionId) q = q.eq("division_id", Number(divisionId));
  if (!isAdmin) q = q.in("division_id", divisionIds.length ? divisionIds : [-1]);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const service = createAdminClient();
  const signed = await signPaths(service, data ?? []);
  const withUrls = (data ?? []).map((r) => ({
    ...r,
    photo_url: r.photo_path ? signed.get(r.photo_path) ?? null : null,
    id_photo_url: r.id_photo_path ? signed.get(r.id_photo_path) ?? null : null,
  }));
  return NextResponse.json(withUrls);
}

// POST (multipart): PIC/admin directly creates a request, with photo + ID photo.
export async function POST(request: Request) {
  const { isAdmin, isPic, divisionIds } = await getEventidAccess();
  if (!isAdmin && !isPic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const event_id = Number(form.get("event_id"));
  const division_id = Number(form.get("division_id"));
  const full_name = (form.get("full_name") as string)?.trim();
  const status = ((form.get("status") as string) || "pending").toLowerCase();

  if (!event_id || !division_id || !full_name) {
    return NextResponse.json({ error: "event_id, division_id, full_name required" }, { status: 400 });
  }
  if (!isAdmin && !divisionIds.includes(division_id)) {
    return NextResponse.json({ error: "Forbidden for this division" }, { status: 403 });
  }

  const service = createAdminClient();
  const photo_path = await uploadField(service, form, "photo", event_id, division_id, "portrait");
  const id_photo_path = await uploadField(service, form, "id_photo", event_id, division_id, "id");

  const { error } = await service.from("eventid_requests").insert({
    event_id,
    division_id,
    full_name,
    photo_path,
    id_photo_path,
    status: ["pending", "approved", "rejected"].includes(status) ? status : "pending",
    submitted_via: "pic",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

// PATCH: approve / reject / edit a request. Admin any; PIC own divisions.
export async function PATCH(request: Request) {
  const { supabase, isAdmin, isPic, divisionIds, email } = await getEventidAccess();
  const body = await request.json();
  const { id, action, message, full_name } = body as {
    id: number;
    action: "approve" | "reject" | "edit";
    message?: string;
    full_name?: string;
  };
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  // Scope: confirm the request's division is in reach.
  const { data: existing } = await supabase
    .from("eventid_requests")
    .select("division_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && !(isPic && divisionIds.includes(existing.division_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createAdminClient();
  let patch: Record<string, unknown>;
  if (action === "approve" || action === "reject") {
    patch = {
      status: action === "approve" ? "approved" : "rejected",
      reviewed_by: email,
      reviewed_at: new Date().toISOString(),
      review_message: message?.trim() || null,
    };
  } else {
    patch = {};
    if (full_name !== undefined) patch.full_name = String(full_name).trim();
  }

  const { error } = await service.from("eventid_requests").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

// DELETE: remove a request + its photos. Admin any; PIC own divisions.
export async function DELETE(request: Request) {
  const { supabase, isAdmin, isPic, divisionIds } = await getEventidAccess();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("eventid_requests")
    .select("division_id, photo_path, id_photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAdmin && !(isPic && divisionIds.includes(existing.division_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createAdminClient();
  const paths = [existing.photo_path, existing.id_photo_path].filter(
    (p): p is string => !!p
  );
  if (paths.length) await service.storage.from(BUCKET).remove(paths);
  const { error } = await service.from("eventid_requests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

// Shared: convert (HEIC→JPEG) + upload one form file field to the private bucket.
async function uploadField(
  service: ReturnType<typeof createAdminClient>,
  form: FormData,
  field: string,
  eventId: number,
  divisionId: number,
  label: string
): Promise<string | null> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  const jpeg = await toJpeg({
    name: file.name,
    type: file.type,
    buffer: await file.arrayBuffer(),
  });
  const safe = jpeg.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `eventid/${eventId}/${divisionId}/${Date.now()}-${label}-${safe}`;
  const { error } = await service.storage
    .from(BUCKET)
    .upload(path, jpeg.buffer, { contentType: jpeg.type, upsert: false });
  if (error) throw error;
  return path;
}
