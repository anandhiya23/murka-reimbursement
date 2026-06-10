import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthIdentity {
  id: string;
  email: string | null;
}

// Resolve the caller from the JWT. Uses getClaims() which verifies asymmetric
// (ES256) tokens LOCALLY — no round-trip to the auth server, so it doesn't hit
// the Supabase Auth rate limit the way getUser() does on every request.
export async function getAuthIdentity(
  supabase: SupabaseClient
): Promise<AuthIdentity | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: (claims.email as string) ?? null };
}
