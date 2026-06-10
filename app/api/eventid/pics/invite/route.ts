import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { inviteUser } from "@/lib/invite-user";

// POST: invite a NEW user as PIC and assign them to divisions (admin).
// Idempotent: an existing user just gets the role + assignments added.
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, division_ids } = await request.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  const divisions: number[] = Array.isArray(division_ids) ? division_ids : [];

  const service = createAdminClient();
  const origin = new URL(request.url).origin;

  const invite = await inviteUser(service, clean, origin);
  if (!invite.ok) {
    return NextResponse.json({ error: invite.error }, { status: 400 });
  }

  // Grant eventid PIC role.
  await service
    .from("user_app_roles")
    .upsert({ email: clean, app_key: "eventid", role: "pic" }, { onConflict: "email,app_key,role" });

  // Assign to chosen divisions.
  if (divisions.length) {
    const rows = divisions.map((division_id) => ({ division_id, email: clean }));
    const { error } = await service
      .from("eventid_division_pics")
      .upsert(rows, { onConflict: "division_id,email" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ status: "OK", alreadyExists: invite.alreadyExists });
}
