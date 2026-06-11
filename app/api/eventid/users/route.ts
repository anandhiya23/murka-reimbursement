import { NextResponse } from "next/server";
import { getEventidAccess } from "@/utils/supabase/eventid-access";
import { createAdminClient } from "@/utils/supabase/admin";

// GET: all auth accounts, for the admin PIC picker (search) and to surface
// which assigned PICs have not yet accepted their invite.
//   confirmed = the account has set a password / signed in at least once.
//   An unconfirmed account is an outstanding invite.
export async function GET() {
  const { isAdmin } = await getEventidAccess();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createAdminClient();
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users
    .filter((u) => u.email)
    .map((u) => ({
      email: u.email!.toLowerCase(),
      name: (u.user_metadata?.full_name as string | undefined)?.trim() || null,
      confirmed: !!(u.email_confirmed_at || u.last_sign_in_at),
    }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

  return NextResponse.json(users);
}
