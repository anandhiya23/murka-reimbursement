import { verifyAppRole } from "@/utils/supabase/verify-role";

export interface EventidAccess {
  supabase: Awaited<ReturnType<typeof verifyAppRole>>["supabase"];
  email: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean; // super-admin OR eventid admin
  isPic: boolean;
  divisionIds: number[]; // divisions this PIC is assigned to (empty for pure admins)
}

// Resolves the caller's EventID access: admin (full) vs PIC (scoped to divisions).
export async function getEventidAccess(): Promise<EventidAccess> {
  const { supabase, user, role, isSuperAdmin } = await verifyAppRole("eventid", [
    "admin",
    "pic",
  ]);

  const isAdmin = isSuperAdmin || role === "admin";

  // Division assignments are keyed by email, independent of role. An admin (or
  // super-admin) can also be assigned as a PIC, so always resolve assignments by
  // email rather than gating on the matched role — otherwise admins who are also
  // PICs would never see their own divisions.
  let divisionIds: number[] = [];
  if (user?.email) {
    const { data } = await supabase
      .from("eventid_division_pics")
      .select("division_id")
      .eq("email", user.email);
    divisionIds = (data ?? []).map((r) => r.division_id);
  }
  const isPic = role === "pic" || divisionIds.length > 0;

  return {
    supabase,
    email: user?.email ?? null,
    isSuperAdmin,
    isAdmin,
    isPic,
    divisionIds,
  };
}
