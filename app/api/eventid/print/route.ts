import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { buildIdCardsPdf, type CardInput } from "@/lib/id-card-pdf";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel: allow long batches

const BUCKET = "eventid-photos";
const CONCURRENCY = 8;

// POST { eventId, requestIds? } : render approved requests to a multi-page
// CR80 PDF (1 card/page). requestIds = "Print Selected"; omit = all approved
// for the event. Admin only.
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId, requestIds } = await request.json();
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const service = createAdminClient();

  const { data: event } = await service
    .from("eventid_events")
    .select("name")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let q = service
    .from("eventid_requests")
    .select("id, full_name, photo_path, eventid_divisions(name)")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("id");
  if (Array.isArray(requestIds) && requestIds.length) {
    q = q.in("id", requestIds);
  }
  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) {
    return NextResponse.json({ error: "No approved requests to print" }, { status: 400 });
  }

  // Download + downscale each portrait (bounded concurrency).
  const cards: CardInput[] = new Array(rows.length);
  let cursor = 0;
  async function worker() {
    while (cursor < rows!.length) {
      const i = cursor++;
      const r = rows![i];
      const division = (r.eventid_divisions as unknown as { name: string })?.name ?? "";
      let image: CardInput["image"] = null;
      if (r.photo_path) {
        try {
          const { data: blob } = await service.storage.from(BUCKET).download(r.photo_path);
          if (blob) {
            const input = Buffer.from(await blob.arrayBuffer());
            const jpg = await sharp(input)
              .rotate() // respect EXIF orientation
              .resize({ width: 600, height: 720, fit: "inside" })
              .jpeg({ quality: 80 })
              .toBuffer();
            image = { bytes: new Uint8Array(jpg), format: "jpg" };
          }
        } catch {
          image = null;
        }
      }
      cards[i] = { fullName: r.full_name, division, event: event!.name, image };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const pdf = await buildIdCardsPdf(cards);
  const fileName = `idcards-${event.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
