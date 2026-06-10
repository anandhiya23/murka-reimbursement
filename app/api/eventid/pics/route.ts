import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";

// GET ?divisionId= : PIC assignments for a division (admin).
export async function GET(request: Request) {
  const { supabase, isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const divisionId = new URL(request.url).searchParams.get("divisionId");
  let q = supabase.from("eventid_division_pics").select("id, division_id, email");
  if (divisionId) q = q.eq("division_id", Number(divisionId));
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: assign an EXISTING user (by email) as PIC of a division (admin).
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { division_id, email } = await request.json();
  if (!division_id || !email?.trim()) {
    return NextResponse.json({ error: "division_id and email required" }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  const service = createAdminClient();

  // Ensure they hold the eventid PIC role + the division assignment (idempotent).
  await service
    .from("user_app_roles")
    .upsert({ email: clean, app_key: "eventid", role: "pic" }, { onConflict: "email,app_key,role" });
  const { error } = await service
    .from("eventid_division_pics")
    .upsert({ division_id, email: clean }, { onConflict: "division_id,email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}

// DELETE: unassign a PIC from a division (admin). Leaves their account intact.
export async function DELETE(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { division_id, email } = await request.json();
  if (!division_id || !email) {
    return NextResponse.json({ error: "division_id and email required" }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  const service = createAdminClient();
  const { error } = await service
    .from("eventid_division_pics")
    .delete()
    .eq("division_id", division_id)
    .eq("email", clean);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If they no longer PIC any division, drop the eventid pic role.
  const { count } = await service
    .from("eventid_division_pics")
    .select("id", { count: "exact", head: true })
    .eq("email", clean);
  if (!count) {
    await service
      .from("user_app_roles")
      .delete()
      .eq("email", clean)
      .eq("app_key", "eventid")
      .eq("role", "pic");
  }
  return NextResponse.json({ status: "OK" });
}
