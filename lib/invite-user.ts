import type { SupabaseClient } from "@supabase/supabase-js";

// Sends a Supabase invite email. The recipient sets their own password via the
// link, which lands on /set-password (email auto-confirmed on accept).
// Shared by reimbursement user creation and EventID PIC invites.
//
// Returns { ok, alreadyExists, error }. An "already registered" user is treated
// as a soft success so callers can still attach roles/assignments idempotently.
export async function inviteUser(
  serviceClient: SupabaseClient,
  email: string,
  origin: string
): Promise<{ ok: boolean; alreadyExists: boolean; error: string | null }> {
  const clean = email.trim().toLowerCase();
  const { error } = await serviceClient.auth.admin.inviteUserByEmail(clean, {
    redirectTo: `${origin}/api/auth/callback?next=/set-password`,
  });

  if (!error) return { ok: true, alreadyExists: false, error: null };

  // Supabase returns a 422-ish error when the email already has an account.
  const msg = error.message.toLowerCase();
  if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
    return { ok: true, alreadyExists: true, error: null };
  }
  return { ok: false, alreadyExists: false, error: error.message };
}
