import { createClient } from "@/utils/supabase/server";
import { getAuthIdentity } from "@/utils/supabase/claims";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Returns which apps the current user can access, for the launcher.
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const identity = await getAuthIdentity(supabase);
  if (!identity?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = identity.email.toLowerCase();

  const { data: sa } = await supabase
    .from("super_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (sa) {
    return NextResponse.json({
      email,
      isSuperAdmin: true,
      apps: ["reimbursement", "eventid"],
    });
  }

  const { data: roles } = await supabase
    .from("user_app_roles")
    .select("app_key")
    .eq("email", email);

  const apps = Array.from(new Set((roles ?? []).map((r) => r.app_key)));
  return NextResponse.json({ email, isSuperAdmin: false, apps });
}
