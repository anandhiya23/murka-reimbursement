import { createClient } from "@/utils/supabase/server";
import { getAuthIdentity } from "@/utils/supabase/claims";
import { cookies } from "next/headers";

export interface AppRoleResult {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email: string } | null;
  role: string | null; // matched role for the app, or "super_admin", or null
  isSuperAdmin: boolean;
}

// Generalized role check across apps. Super-admins short-circuit to full access.
// Usage: const { role, user } = await verifyAppRole("eventid", ["admin"]);
export async function verifyAppRole(
  appKey: string,
  allowedRoles: string[]
): Promise<AppRoleResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const identity = await getAuthIdentity(supabase);

  if (!identity?.email) {
    return { supabase, user: null, role: null, isSuperAdmin: false };
  }
  const email = identity.email.toLowerCase();
  const safeUser = { id: identity.id, email };

  // Super-admin: god over all apps.
  const { data: sa } = await supabase
    .from("super_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (sa) {
    return { supabase, user: safeUser, role: "super_admin", isSuperAdmin: true };
  }

  // Match an allowed role for this app.
  const { data: roles } = await supabase
    .from("user_app_roles")
    .select("role")
    .eq("email", email)
    .eq("app_key", appKey);

  const matched =
    roles?.map((r) => r.role).find((r) => allowedRoles.includes(r)) ?? null;

  return { supabase, user: safeUser, role: matched, isSuperAdmin: false };
}
