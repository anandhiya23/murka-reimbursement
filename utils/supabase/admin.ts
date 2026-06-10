import { createClient } from "@supabase/supabase-js";

// Service-role client. Server-only — never import into client components.
// Bypasses RLS; used for auth admin actions (invite, delete) and trusted writes.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Server misconfigured: missing Supabase URL or service role key");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
