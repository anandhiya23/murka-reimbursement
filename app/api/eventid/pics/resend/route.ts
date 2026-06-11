import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";
import { inviteUser } from "@/lib/invite-user";

// POST: re-send a PIC invite to someone who has not accepted yet (admin).
// Supabase refuses to re-invite an existing account, so for an UNCONFIRMED
// user we delete the stub account and invite fresh. Safe because the user
// never signed in, and PIC role/division rows are keyed by email (untouched).
// Refuses if the account is already confirmed — nothing to resend.
export async function POST(request: Request) {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await request.json();
  if (!email?.trim()) return NextResponse.json({ error: "email required" }, { status: 400 });
  const clean = email.trim().toLowerCase();

  const service = createAdminClient();
  const origin = new URL(request.url).origin;

  const { data, error: listErr } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  const account = data.users.find((u) => u.email?.toLowerCase() === clean);

  if (account && (account.email_confirmed_at || account.last_sign_in_at)) {
    return NextResponse.json({ error: "User already active" }, { status: 400 });
  }
  // Drop the stale stub so the invite can be re-issued.
  if (account) {
    const { error: delErr } = await service.auth.admin.deleteUser(account.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  const invite = await inviteUser(service, clean, origin);
  if (!invite.ok) return NextResponse.json({ error: invite.error }, { status: 400 });
  return NextResponse.json({ status: "OK" });
}
